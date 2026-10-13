// Checks local service readiness, not upstream content availability.
try {
  const response = await fetch(
    `http://127.0.0.1:${process.env.PORT || 8788}/health`,
    {
      signal: AbortSignal.timeout(4000),
    }
  );
  const data = await response.json();
  if (!response.ok || data.ok !== true)
    process.exitCode = 1;
} catch {
  process.exitCode = 1;
}
