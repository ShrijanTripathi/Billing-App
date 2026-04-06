import "./globals.css";

export const metadata = {
  title: "Balaji Ji Food Arts - Bill Generator",
  description: "POS bill generator for Balaji Ji Food Arts",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
