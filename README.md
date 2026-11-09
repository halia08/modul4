This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Order management

The `/pesanan` page uses Prisma Client 7 with the PostgreSQL driver adapter. Set `DATABASE_URL` in the project root `.env` to a PostgreSQL connection string, then generate the client and run the app:

```bash
npx prisma generate
npm run dev
```

The `/api/pesanan` route returns products, active orders and the customer/employee choices needed for new orders. It supports:

- `POST` with `id_pelanggan`, `id_karyawan`, and `items` (`id_produk` and `jumlah`) to create an order.
- `PUT` with `no_nota` and `items` to update an unpaid order.
- `DELETE` with `no_nota` to permanently delete an order and its detail rows. Orders with related feedback cannot be deleted.

Line subtotals and the order total are calculated from current product prices by the API.
