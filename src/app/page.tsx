export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <p className="text-brand-deep text-sm font-medium tracking-[0.02em]">
        Prosefield
      </p>
      <h1 className="font-display mt-4 max-w-xl text-center text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
        A calm field for prose.
      </h1>
      <p className="text-muted-foreground mt-4 max-w-md text-center text-lg leading-relaxed">
        Foundation tokens, fonts, and local tooling are in place. Marketing and
        workspace surfaces arrive in later phases.
      </p>
    </div>
  );
}
