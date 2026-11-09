'use client';

export default function SessionLink({ code }: { code: string }) {
  if (!code) return <span>NO CODE</span>;
  
  return (
    <a 
      href={`/sessions?code=${code}`}
      className="text-blue-600 hover:text-blue-800 hover:underline font-bold transition-colors"
      title={`Go to ${code} in Master Schedule`}
    >
      {code}
    </a>
  );
}
