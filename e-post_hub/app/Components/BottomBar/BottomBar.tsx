import Image from "next/image";
import WVAnobg from "../../Images/WVAnobg.png";

export default function BottomBar() {
  return (
    <div
      className="relative w-full bg-gradient-to-r from-[#f7960d] to-[#f95d09] text-black flex items-center justify-center h-[110px] shadow-md"
    >
      <div className="flex flex-row items-center justify-between w-full px-6">
        {/* Contact Us Section with Image */}
        <div className="flex items-center">
          <Image
            src={WVAnobg}
            alt="WVA Logo"
            width={150}
            height={150}
            className="mr-8"
          />

          <div>
            <h3 className="text-lg font-bold">Contact Us</h3>
            <p className="text-sm">
              Email:{" "}
              <a href="mailto:BeckyBuri@whitmancounty.gov " className="underline">
              BeckyBuri@whitmancounty.gov
              </a>
            </p>
            <p className="text-sm">Phone: +1 (509) 397-5246</p>
          </div>
        </div>

        {/* Links Section */}
        <div className="flex flex-col items-center">
          <h3 className="text-lg font-bold">Help & Support</h3>
          <div className="flex space-x-4 mt-2">
            <a href="/Support/external" className="text-sm underline">
              External Resources
            </a>
            <a href="/Support/community" className="text-sm underline">
              Community Questions
            </a>
            {/* <a href="/Support/issue" className="text-sm underline">
              Report a Problem
            </a> */}
          </div>
        </div>

        {/* Branding */}
        <div className="text-right">
          <p className="text-lg font-bold">Veteran e-Post Hub © 2025</p>
        </div>
      </div>
    </div>
  );
}
