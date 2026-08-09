export function GET() {
  return Response.json({ status: "ok", service: "periscope-energy-carbonops", version: "0.1.0", time: new Date().toISOString() });
}
