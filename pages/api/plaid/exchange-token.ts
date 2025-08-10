// pages/api/plaid/exchange-token.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { PlaidApi, Configuration, PlaidEnvironments } from 'plaid';
import prisma from '../../../lib/prisma';
import { encryptPlaidToken } from '../../../lib/encryption';

// optional realtime emit (supports payload)
let triggerFinancialSync:
  | ((userId: string, payload?: { accountId?: string | null; reason?: string }) => Promise<void>)
  | null = null;

if (typeof window === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const websocketServer = require('../../../lib/websocket-server');
    triggerFinancialSync = websocketServer.triggerFinancialSync;
  } catch {
    // ignore — sockets not available during build
  }
}

const plaid = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[(process.env.PLAID_ENV as any) || 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID || '',
        'PLAID-SECRET': process.env.PLAID_SECRET || '',
        'Plaid-Version': '2020-09-14',
      },
    },
  })
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const userId = (session.user as any).id as string | undefined;
  if (!userId) return res.status(401).json({ error: 'No user ID found' });

  try {
    const { public_token, institution } = (req.body ?? {}) as {
      public_token?: string;
      institution?: string;
    };
    if (!public_token) return res.status(400).json({ error: 'Missing public_token' });

    // 1) Exchange public_token → access token + item id
    const tokenRes = await plaid.itemPublicTokenExchange({ public_token });
    const accessToken = tokenRes.data.access_token;
    const itemId = tokenRes.data.item_id;
    if (!accessToken || !itemId) {
      return res.status(502).json({ error: 'Plaid exchange returned empty values' });
    }

    // 2) Upsert the PlaidItem (cursor will live here later)
    const item = await prisma.plaidItem.upsert({
      where: { itemId },
      update: { userId, institution },
      create: { itemId, userId, institution },
      select: { id: true },
    });

    // 3) Fetch accounts for this item and upsert/link them
    const accountsRes = await plaid.accountsGet({ access_token: accessToken });
    console.log(`[exchange-token] Found ${accountsRes.data.accounts.length} accounts for item ${itemId}`);

    const encryptedToken = encryptPlaidToken(accessToken);

    const createdAccounts: Array<{
      id: string;
      name: string;
      type: string;
      balance: number;
    }> = [];

    for (const acc of accountsRes.data.accounts) {
      const accountData = {
        userId,
        plaidAccessToken: encryptedToken,
        plaidItemId: item.id, // link account → item
        accountName: acc.name || acc.official_name || (acc.mask ? `Account ${acc.mask}` : 'Account'),
        accountType: acc.type,
        // NOTE: avoid writing null if your Prisma field is String?
        accountSubtype: (acc.subtype as string | undefined) || undefined,
        balance: acc.balances.current ?? 0,
        availableBalance: acc.balances.available ?? null,
      };

      // Use composite unique (userId, plaidAccountId)
      const account = await prisma.account.upsert({
        where: {
          // Prisma exposes a compound unique selector named by fields joined with underscore
          userId_plaidAccountId: {
            userId,
            plaidAccountId: acc.account_id,
          },
        },
        update: accountData,
        create: {
          ...accountData,
          plaidAccountId: acc.account_id,
        },
      });

      createdAccounts.push({
        id: account.id,
        name: account.accountName,
        type: account.accountType,
        balance: account.balance,
      });
    }

    // 4) Try to trigger initial transaction sync (non-fatal if fails)
    try {
      const origin =
        (req.headers.origin as string | undefined) ||
        process.env.NEXTAUTH_URL ||
        'http://localhost:3001';

      const syncUrl = `${origin.replace(/\/$/, '')}/api/plaid/sync`;
      console.log(`[exchange-token] Triggering initial sync: ${syncUrl}`);

      const syncResponse = await fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // your /api/plaid/sync should allow a bypass with this UA or a secret
          'User-Agent': 'plaid-webhook-sync',
        },
        body: JSON.stringify({ webhookUserId: userId }),
      });

      if (syncResponse.ok) {
        const syncResult = await syncResponse.json();
        console.log(`[exchange-token] Initial sync completed: ${syncResult.message}`);
      } else {
        console.warn(`[exchange-token] Initial sync failed: ${syncResponse.status}`);
      }
    } catch (syncError) {
      console.warn('[exchange-token] Failed to trigger initial sync:', syncError);
    }

    // 5) Realtime ping (import)
    if (triggerFinancialSync) {
      try {
        await triggerFinancialSync(userId, { reason: 'import' });
      } catch (e: any) {
        console.warn('[exchange-token] ws emit failed:', e?.message || e);
      }
    }

    return res.json({
      ok: true,
      itemId,
      accountCount: accountsRes.data.accounts.length,
      accounts: createdAccounts,
    });
  } catch (err: any) {
    console.error('exchange-token error', err?.response?.data || err);
    return res.status(500).json({ error: 'Failed to exchange token' });
  }
}