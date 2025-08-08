import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { PlaidApi, Configuration, PlaidEnvironments } from 'plaid';
import prisma from '../../../lib/prisma';
import { encryptPlaidToken } from '../../../lib/encryption';

// optional realtime emit
let triggerFinancialSync: ((userId: string) => Promise<void>) | null = null;
if (typeof window === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const websocketServer = require('../../../lib/websocket-server');
    triggerFinancialSync = websocketServer.triggerFinancialSync;
  } catch {}
}

const plaid = new PlaidApi(new Configuration({
  basePath: PlaidEnvironments[(process.env.PLAID_ENV as any) || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID || '',
      'PLAID-SECRET': process.env.PLAID_SECRET || '',
      'Plaid-Version': '2020-09-14',
    },
  },
}));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });
  const userId = (session.user as any).id;

  try {
    const { public_token, institution } = req.body || {};
    if (!public_token) return res.status(400).json({ error: 'Missing public_token' });

    // 1) Exchange public_token → access token + item id
    const tokenRes = await plaid.itemPublicTokenExchange({ public_token });
    const accessToken = tokenRes.data.access_token;
    const itemId = tokenRes.data.item_id;
    if (!accessToken || !itemId) {
      return res.status(502).json({ error: 'Plaid exchange returned empty values' });
    }

    // 2) Upsert the PlaidItem (per ITEM cursor lives here)
    const item = await prisma.plaidItem.upsert({
      where: { itemId },
      update: { userId, institution },
      create: { itemId, userId, institution },
      select: { id: true },
    });

    // 3) Fetch accounts for this item and upsert/link them
    const accountsRes = await plaid.accountsGet({ access_token: accessToken });
    console.log(`[exchange-token] Found ${accountsRes.data.accounts.length} accounts for item ${itemId}`);
    
    // Encrypt the access token for storage
    const encryptedToken = encryptPlaidToken(accessToken);
    
    const createdAccounts = [];
    for (const acc of accountsRes.data.accounts) {
      const accountData = {
        userId,
        plaidAccessToken: encryptedToken,
        plaidItemId: item.id, // link account → item
        accountName: acc.name || acc.official_name || `Account ${acc.mask}` || 'Account',
        accountType: acc.type,
        accountSubtype: acc.subtype || null,
        balance: acc.balances.current ?? 0,
        availableBalance: acc.balances.available ?? null,
      };
      
      const account = await prisma.account.upsert({
        where: { plaidAccountId: acc.account_id },
        update: accountData,
        create: {
          ...accountData,
          plaidAccountId: acc.account_id,
        },
      });
      
      createdAccounts.push(account);
      console.log(`[exchange-token] ${account.id ? 'Updated' : 'Created'} account: ${accountData.accountName} (${acc.type})`);
    }


    // 4) Trigger initial transaction sync for this new item
    console.log(`[exchange-token] Triggering initial sync for new item ${itemId}`);
    try {
      // Use fetch to call our own sync endpoint
      const syncUrl = `${req.headers.origin || 'http://localhost:3001'}/api/plaid/sync`;
      const syncResponse = await fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': req.headers.cookie || '',
        },
      });
      
      if (syncResponse.ok) {
        const syncResult = await syncResponse.json();
        console.log(`[exchange-token] Initial sync completed: ${syncResult.message}`);
      } else {
        console.warn(`[exchange-token] Initial sync failed: ${syncResponse.status}`);
      }
    } catch (syncError) {
      console.warn('[exchange-token] Failed to trigger initial sync:', syncError);
      // Don't fail the exchange if sync fails - user can sync manually
    }

    // 5) Optional realtime ping
    if (triggerFinancialSync) await triggerFinancialSync(userId);

    return res.json({ 
      ok: true, 
      itemId, 
      accountCount: accountsRes.data.accounts.length,
      accounts: createdAccounts.map(acc => ({
        id: acc.id,
        name: acc.accountName,
        type: acc.accountType,
        balance: acc.balance,
      })),
    });
  } catch (err: any) {
    console.error('exchange-token error', err?.response?.data || err);
    return res.status(500).json({ error: 'Failed to exchange token' });
  }
}