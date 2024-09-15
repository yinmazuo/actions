import express from 'express';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { createPostResponse, actionCorsMiddleware } from '@solana/actions';

const DEFAULT_SOL_ADDRESS = new PublicKey('EPsRTLtfgaKyFtJd4ckiyKLTjcqogWztVhBjffJ9jd8n') || Keypair.generate().publicKey;
const DEFAULT_SOL_AMOUNT = 0.1;
const connection = new Connection(clusterApiUrl('mainnet-beta'));

const PORT = 8080;
const BASE_URL = `http://localhost:${PORT}`;

// Express app setup
const app = express();
app.use(express.json());

/**
 * The `actionCorsMiddleware` middleware will provide the correct CORS settings for Action APIs
 * so you do not need to use an additional `cors` middleware if you do not require it for other reasons
 */
app.use(actionCorsMiddleware());

// Routes
app.get('/actions.json', getActionsJson);
app.get('/api/actions/transfer-sol', getTransferSol);
app.post('/api/actions/transfer-sol', postTransferSol);

// Route handlers
function getActionsJson(req, res) {
  const payload = {
    rules: [
      { pathPattern: '/*', apiPath: '/api/actions/*' },
      { pathPattern: '/api/actions/**', apiPath: '/api/actions/**' },
    ],
  };
  res.json(payload);
}

async function getTransferSol(req, res) {
  try {
    const { toPubkey } = validatedQueryParams(req.query);
    const baseHref = `${BASE_URL}/api/actions/transfer-sol?to=${toPubkey.toBase58()}`;

    const payload = {
      type: 'action',
      title: 'Donate to Selena',
      icon: 'https://helioimages113109-prod.s3.eu-west-1.amazonaws.com/attachments/jBxiVvu8XPjrFGqccnCfofnlvHvoya3sLR2DUHvu.jpg?AWSAccessKeyId=AKIAZIDE2VZRR4E6NXMZ&Expires=1726387145&Signature=v0B6q8T%2F4VVl%2F65Le9zKoZrzxow%3D',
      description: 'Biomedical expert | Support my research with a donation.',
      links: {
        actions: [
          { label: 'Send 0.1 SOL', href: `${baseHref}&amount=0.1` },
          { label: 'Send 0.5 SOL', href: `${baseHref}&amount=0.5` },
          { label: 'Send 1 SOL', href: `${baseHref}&amount=1` },
          // {
          //   label: 'Send SOL',
          //   href: `${baseHref}&amount={amount}`,
          //   parameters: [
          //     {
          //       name: 'amount',
          //       label: 'Enter the amount of SOL to send',
          //       required: true,
          //     },
          //   ],
          // },
        ],
      },
    };

    res.json(payload);
  } catch (err) {
    console.error(err);
    // handleError(res, err);
    res.status(500).json({ message: err?.message || err });
  }
}

async function postTransferSol(req, res) {
  try {
    const { amount, toPubkey } = validatedQueryParams(req.query);
    const { account } = req.body;

    if (!account) {
      throw new Error('Invalid "account" provided');
    }

    const fromPubkey = new PublicKey(account);
    const minimumBalance =
      await connection.getMinimumBalanceForRentExemption(0);

    if (amount * LAMPORTS_PER_SOL < minimumBalance) {
      throw new Error(`Account may not be rent exempt: ${toPubkey.toBase58()}`);
    }

    // create an instruction to transfer native SOL from one wallet to another
    const transferSolInstruction = SystemProgram.transfer({
      fromPubkey: fromPubkey,
      toPubkey: toPubkey,
      lamports: amount * LAMPORTS_PER_SOL,
    });

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    // create a legacy transaction
    const transaction = new Transaction({
      feePayer: fromPubkey,
      blockhash,
      lastValidBlockHeight,
    }).add(transferSolInstruction);

    // versioned transactions are also supported
    // const transaction = new VersionedTransaction(
    //   new TransactionMessage({
    //     payerKey: fromPubkey,
    //     recentBlockhash: blockhash,
    //     instructions: [transferSolInstruction],
    //   }).compileToV0Message(),
    //   // note: you can also use `compileToLegacyMessage`
    // );

    const payload = await createPostResponse({
      fields: {
        transaction,
        message: `Send ${amount} SOL to ${toPubkey.toBase58()}`,
      },
      // note: no additional signers are needed
      // signers: [],
    });

    res.json(payload);
  } catch (err) {
    res.status(400).json({ error: err.message || 'An unknown error occurred' });
  }
}

function validatedQueryParams(query) {
  let toPubkey = DEFAULT_SOL_ADDRESS;
  let amount = DEFAULT_SOL_AMOUNT;

  if (query.to) {
    try {
      toPubkey = new PublicKey(query.to);
    } catch (err) {
      throw new Error('Invalid input query parameter: to');
    }
  }

  try {
    if (query.amount) {
      amount = parseFloat(query.amount);
    }
    if (amount <= 0) throw new Error('amount is too small');
  } catch (err) {
    throw new Error('Invalid input query parameter: amount');
  }

  return { amount, toPubkey };
}

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
