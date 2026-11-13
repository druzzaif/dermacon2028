'use client';

export default function SessionLink({ code }: { code: string }) {
  if (!code) return <span>NO CODE</span>;
  
  return (
    <a 
      href={`/sessions?code=${code}`}
      className="font-semibold text-accent transition-colors hover:text-accent-strong hover:underline"
      title={`Go to ${code} in Master Schedule`}
    >
      {code}
    </a>
  );
}
