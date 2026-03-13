import { cn } from "@/lib/utils/cn";

export function SiteMascot({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("h-20 w-20 shrink-0", className)}
      fill="none"
      viewBox="0 0 128 128"
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse cx="64" cy="113" fill="rgba(16,32,45,0.1)" rx="24" ry="6" />

      <path
        d="M44 17C50 12 58 10 66 11C84 12 96 25 96 42V76C96 93 84 106 67 108C49 110 34 98 32 81L30 44C29 33 34 23 44 17Z"
        fill="#F3D05C"
        stroke="#10202D"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <path
        d="M47 21C53 17 60 15 68 16C82 17 92 28 92 42V74C92 88 81 99 67 101C53 103 40 94 37 80L35 46C34 35 38 26 47 21Z"
        stroke="#10202D"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.2"
        strokeWidth="1.5"
      />

      <path
        d="M43 17C44 14 46 12 49 10"
        stroke="#10202D"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path
        d="M56 13C57 10 59 8 62 7"
        stroke="#10202D"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path
        d="M70 13C72 10 74 9 77 8"
        stroke="#10202D"
        strokeLinecap="round"
        strokeWidth="3"
      />

      <ellipse cx="52" cy="52" fill="#FBFCFD" rx="11.5" ry="12.5" stroke="#10202D" strokeWidth="3" />
      <ellipse cx="76" cy="52" fill="#FBFCFD" rx="11.5" ry="12.5" stroke="#10202D" strokeWidth="3" />
      <path
        d="M63 52H65"
        stroke="#10202D"
        strokeLinecap="round"
        strokeWidth="2.5"
      />
      <circle cx="54" cy="55" fill="#10202D" r="3.6" />
      <circle cx="78" cy="55" fill="#10202D" r="3.6" />
      <circle cx="55.4" cy="53.7" fill="#fff" r="1.2" />
      <circle cx="79.4" cy="53.7" fill="#fff" r="1.2" />

      <path
        d="M55 73C59 77 67 78 73 73"
        stroke="#10202D"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <ellipse cx="45" cy="68.5" fill="#E8A78F" opacity="0.55" rx="4.5" ry="2.5" />
      <ellipse cx="84" cy="68.5" fill="#E8A78F" opacity="0.55" rx="4.5" ry="2.5" />

      <path
        d="M90 70C96 68 101 70 104 75"
        stroke="#10202D"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path
        d="M102 73L105 67"
        stroke="#10202D"
        strokeLinecap="round"
        strokeWidth="2.5"
      />

      <path
        d="M96 62L110 59L112 76L98 79L96 62Z"
        fill="#FFFCF4"
        stroke="#10202D"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      <path
        d="M100 64L107 63"
        stroke="#0F7F84"
        strokeLinecap="round"
        strokeOpacity="0.7"
        strokeWidth="2"
      />
      <path
        d="M100 69L108 68"
        stroke="#0F7F84"
        strokeLinecap="round"
        strokeOpacity="0.7"
        strokeWidth="2"
      />
      <path
        d="M100 74L106 73"
        stroke="#0F7F84"
        strokeLinecap="round"
        strokeOpacity="0.7"
        strokeWidth="2"
      />

      <path
        d="M42 87L38 96"
        stroke="#10202D"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path
        d="M54 92L52 103"
        stroke="#10202D"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path
        d="M73 92L75 103"
        stroke="#10202D"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path
        d="M86 87L92 95"
        stroke="#10202D"
        strokeLinecap="round"
        strokeWidth="3"
      />

      <path
        d="M47 104C50 106 54 106 57 104"
        stroke="#10202D"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path
        d="M71 104C74 106 78 106 81 104"
        stroke="#10202D"
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  );
}
