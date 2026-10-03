import "./globals.css";

export const metadata = {
  title: "Jayden Zheng — Spider",
  description: "Jayden Zheng — musician, swimmer, runner, and creator."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
