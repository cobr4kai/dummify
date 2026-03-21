import {
  createMethodNotAllowedMcpResponse,
  handleReadAbstractedMcpPost,
} from "@/lib/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return createMethodNotAllowedMcpResponse();
}

export async function POST(request: Request) {
  return handleReadAbstractedMcpPost(request, {
    requestOrigin: new URL(request.url).origin,
  });
}

export async function DELETE() {
  return createMethodNotAllowedMcpResponse();
}
