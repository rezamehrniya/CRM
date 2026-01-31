type PlaceholderProps = { title: string; description?: string };

export default function Placeholder({ title, description = 'این بخش به زودی در دسترس خواهد بود.' }: PlaceholderProps) {
  return (
    <div className="space-y-5">
      <h1 className="text-title-lg font-title">{title}</h1>
      <div className="glass-card rounded-card p-8 md:p-12 text-center">
        <p className="text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
