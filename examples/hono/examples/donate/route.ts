import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  VersionedTransaction,
} from '@solana/web3.js';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  actionSpecOpenApiPostRequestBody,
  actionsSpecOpenApiGetResponse,
  actionsSpecOpenApiPostResponse,
} from '../openapi';
import { prepareTransaction } from '../../shared/transaction-utils';
import {
  ActionGetResponse,
  ActionPostRequest,
  ActionPostResponse,
} from '@solana/actions';

const DONATION_DESTINATION_WALLET =
  'EPsRTLtfgaKyFtJd4ckiyKLTjcqogWztVhBjffJ9jd8n';
const DONATION_AMOUNT_SOL_OPTIONS = [0.1, 0.5, 1];
const DEFAULT_DONATION_AMOUNT_SOL = 0.1;

const app = new OpenAPIHono();

app.openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['Donate'],
    responses: actionsSpecOpenApiGetResponse,
  }),
  (c) => {
    const { icon, title, description } = getDonateInfo();
    const amountParameterName = 'amount';
    const response: ActionGetResponse = {
      type: 'action',
      icon,
      label: `${DEFAULT_DONATION_AMOUNT_SOL} SOL`,
      title,
      description,
      links: {
        actions: [
          ...DONATION_AMOUNT_SOL_OPTIONS.map((amount) => ({
            label: `${amount} SOL`,
            href: `/api/donate/${amount}`,
          })),
          {
            href: `/api/donate/{${amountParameterName}}`,
            label: 'Donate',
            parameters: [
              {
                name: amountParameterName,
                label: 'Enter a custom SOL amount',
              },
            ],
          },
        ],
      },
    };

    return c.json(response, 200);
  },
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/{amount}',
    tags: ['Donate'],
    request: {
      params: z.object({
        amount: z.string().openapi({
          param: {
            name: 'amount',
            in: 'path',
          },
          type: 'number',
          example: '1',
        }),
      }),
    },
    responses: actionsSpecOpenApiGetResponse,
  }),
  (c) => {
    const amount = c.req.param('amount');
    const { icon, title, description } = getDonateInfo();
    const response: ActionGetResponse = {
      type: 'action',
      icon,
      label: `${amount} SOL`,
      title,
      description,
    };
    return c.json(response, 200);
  },
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/{amount}',
    tags: ['Donate'],
    request: {
      params: z.object({
        amount: z
          .string()
          .optional()
          .openapi({
            param: {
              name: 'amount',
              in: 'path',
              required: false,
            },
            type: 'number',
            example: '1',
          }),
      }),
      body: actionSpecOpenApiPostRequestBody,
    },
    responses: actionsSpecOpenApiPostResponse,
  }),
  async (c) => {
    const amount =
      c.req.param('amount') ?? DEFAULT_DONATION_AMOUNT_SOL.toString();
    const { account } = (await c.req.json()) as ActionPostRequest;

    const parsedAmount = parseFloat(amount);
    const transaction = await prepareDonateTransaction(
      new PublicKey(account),
      new PublicKey(DONATION_DESTINATION_WALLET),
      parsedAmount * LAMPORTS_PER_SOL,
    );
    const response: ActionPostResponse = {
      transaction: Buffer.from(transaction.serialize()).toString('base64'),
    };
    return c.json(response, 200);
  },
);

function getDonateInfo(): Pick<
  ActionGetResponse,
  'icon' | 'title' | 'description'
> {
  const icon =
    'https://helioimages113109-prod.s3.eu-west-1.amazonaws.com/attachments/jBxiVvu8XPjrFGqccnCfofnlvHvoya3sLR2DUHvu.jpg?AWSAccessKeyId=AKIAZIDE2VZRR4E6NXMZ&Expires=1726387145&Signature=v0B6q8T%2F4VVl%2F65Le9zKoZrzxow%3D';
  const title = 'Donate to Selena';
  const description =
    'Biomedical expert | Support my research with a donation.';
  return { icon, title, description };
}
async function prepareDonateTransaction(
  sender: PublicKey,
  recipient: PublicKey,
  lamports: number,
): Promise<VersionedTransaction> {
  const payer = new PublicKey(sender);
  const instructions = [
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: new PublicKey(recipient),
      lamports: lamports,
    }),
  ];
  return prepareTransaction(instructions, payer);
}

export default app;
