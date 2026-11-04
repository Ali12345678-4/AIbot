import Link from "next/link";
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="eyebrow">404</p>
        <h1 className="display-md mt-2">Wrong turn.</h1>
        <p className="lede mt-3">The page you’re looking for doesn’t exist.</p>
        <Link href="/" className="btn btn-primary mt-8">Back to home</Link>
      </div>
    </main>
  );
}
