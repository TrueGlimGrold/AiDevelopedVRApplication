import "./globals.css";

export const metadata = {
  title: "Quest Phone Capture Prototype",
  description: "Phone-side capture app prototype for Quest transfer"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
