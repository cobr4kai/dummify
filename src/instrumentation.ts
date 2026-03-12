export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { startLocalScheduler } = await import("@/lib/cron");
  await startLocalScheduler();
}
