//Used for base layout for all pages. For instance the self contained navBar

import type { Metadata } from "next";
import "./globals.css";
import Providers from "./Components/Providers";
import TopNav from "./Components/Navbar/TopNav";
import { EdgeStoreProvider } from "@/lib/edgestore";

export const metadata: Metadata = {
  title: "Veteran e-Post Hub",
  description: "A platform to connect veterans with resources and support.",
  icons: { icon: "./whitman.png", },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="">
        <EdgeStoreProvider>
        <Providers>
          <TopNav />
          <main className="w-full mx-auto ">
            {children}
          </main>
        </Providers>
        </EdgeStoreProvider>
      </body>
    </html> 
  );
}