import {
  createMethodNotAllowedMcpResponse,
  handleReadAbstractedMcpPost,
} from "@/lib/mcp/server";
import { getRequestOrigin } from "@/lib/content/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return createMethodNotAllowedMcpResponse();
}

export async function POST(request: Request) {
  return handleReadAbstractedMcpPost(request, {
    requestOrigin: getRequestOrigin(request),
  });
}

export async function DELETE() {
  return createMethodNotAllowedMcpResponse();
}
