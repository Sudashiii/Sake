import type { RequestEvent } from "@sveltejs/kit";
import { userRepository } from "$lib/server/application/composition";
import { verifyPassword } from "$lib/server/application/services/LocalAuthService";

export async function requireBasicAuth(
  event: RequestEvent,
): Promise<Response | null> {
  const authHeader = event.request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return new Response("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="OPDS Catalog"',
      },
    });
  }

  const base64Credentials = authHeader.substring(6);
  const credentials = Buffer.from(base64Credentials, "base64").toString(
    "utf-8",
  );
  const [username, ...passwordParts] = credentials.split(":");
  const password = passwordParts.join(":");

  if (!username || !password) {
    return new Response("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="OPDS Catalog"',
      },
    });
  }

  const user = await userRepository.getByUsername(username);
  if (!user || user.isDisabled) {
    return new Response("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="OPDS Catalog"',
      },
    });
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    return new Response("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="OPDS Catalog"',
      },
    });
  }

  // Authenticated successfully
  return null;
}
