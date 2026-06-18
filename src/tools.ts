import {
  WikiJsToolDefinition,
  WikiJsPage,
  WikiJsUser,
  WikiJsGroup,
  ResponseResult,
} from "./types.js";
import { GraphQLClient, gql } from "graphql-request";
import { fixPageAuthor } from "./db.js";

// GraphQL API response interfaces
interface PageResponse {
  pages: {
    single: WikiJsPage;
  };
}

interface PageContentResponse {
  pages: {
    single: {
      content: string;
    };
  };
}

interface PagesListResponse {
  pages: {
    list: WikiJsPage[];
  };
}

interface PagesSearchResponse {
  pages: {
    search: {
      results: {
        id: string;
        title: string;
        description: string;
        path: string;
        locale: string;
      }[];
      suggestions: string[];
      totalHits: number;
    };
  };
}

interface PageCreateResponse {
  pages: {
    create: {
      responseResult: ResponseResult;
      page: WikiJsPage;
    };
  };
}

interface PageUpdateResponse {
  pages: {
    update: {
      responseResult: ResponseResult;
      page: WikiJsPage;
    };
  };
}

interface PageDeleteResponse {
  pages: {
    delete: {
      responseResult: ResponseResult;
    };
  };
}

interface PageMoveResponse {
  pages: {
    move: {
      responseResult: ResponseResult;
    };
  };
}

interface UsersListResponse {
  users: {
    list: WikiJsUser[];
  };
}

interface UsersSearchResponse {
  users: {
    search: WikiJsUser[];
  };
}

interface GroupsListResponse {
  groups: {
    list: WikiJsGroup[];
  };
}

interface UserCreateResponse {
  users: {
    create: WikiJsUser;
  };
}

interface UserUpdateResponse {
  users: {
    update: WikiJsUser;
  };
}

// MCP tool definitions for Wiki.js
export const wikiJsTools: WikiJsToolDefinition[] = [
  // Get page by ID
  {
    type: "function",
    function: {
      name: "get_page",
      description: "Get Wiki.js page information by its ID",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "Page ID in Wiki.js",
          },
        },
        required: ["id"],
      },
    },
  },

  // Get page content by ID
  {
    type: "function",
    function: {
      name: "get_page_content",
      description: "Get Wiki.js page content by its ID",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "Page ID in Wiki.js",
          },
        },
        required: ["id"],
      },
    },
  },

  // List pages
  {
    type: "function",
    function: {
      name: "list_pages",
      description: "Get a list of Wiki.js pages with optional sorting",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description:
              "Maximum number of pages to return (default 50)",
          },
          orderBy: {
            type: "string",
            description: "Sort field (TITLE, CREATED, UPDATED)",
          },
        },
        required: [],
      },
    },
  },

  // Search pages
  {
    type: "function",
    function: {
      name: "search_pages",
      description: "Search pages by query in Wiki.js",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query",
          },
          limit: {
            type: "number",
            description:
              "Maximum number of results (default 10)",
          },
        },
        required: ["query"],
      },
    },
  },

  // Create page
  {
    type: "function",
    function: {
      name: "create_page",
      description: "Create a new page in Wiki.js",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Page title",
          },
          content: {
            type: "string",
            description: "Page content (Markdown format)",
          },
          path: {
            type: "string",
            description: "Page path (e.g. 'folder/page')",
          },
          description: {
            type: "string",
            description: "Short page description",
          },
          tags: {
            type: "array",
            items: {
              type: "string",
            },
            description: "Page tags",
          },
          published: {
            type: "boolean",
            description:
              "Whether the page is published and visible to all users (default: true). Set to false to save as a draft visible only to editors.",
          },
        },
        required: ["title", "content", "path"],
      },
    },
  },

  // Update page
  {
    type: "function",
    function: {
      name: "update_page",
      description: "Update an existing page in Wiki.js",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "Page ID to update",
          },
          content: {
            type: "string",
            description: "New page content (Markdown format)",
          },
          title: {
            type: "string",
            description: "New page title (optional, only updated if provided)",
          },
          description: {
            type: "string",
            description:
              "New page description (optional, only updated if provided)",
          },
        },
        required: ["id", "content"],
      },
    },
  },

  // Patch page (content-anchored find/replace)
  {
    type: "function",
    function: {
      name: "patch_page",
      description:
        "Edit part of a page without re-sending the whole page. Fetches the current content server-side, replaces old_string with new_string, and saves the merged result. old_string is matched by EXACT content (never by line number) and may span multiple lines. Like the Edit tool: old_string must be unique unless replace_all is true, and an exact substring of the current content (whitespace and line breaks included). Use this instead of update_page for small edits.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "Page ID to edit",
          },
          old_string: {
            type: "string",
            description:
              "Exact text to find in the current page content (may be multi-line). Must match byte-for-byte and be unique unless replace_all is set.",
          },
          new_string: {
            type: "string",
            description: "Text to replace old_string with.",
          },
          replace_all: {
            type: "boolean",
            description:
              "Replace every occurrence of old_string instead of requiring it to be unique (default false).",
          },
        },
        required: ["id", "old_string", "new_string"],
      },
    },
  },

  // Replace section (by Markdown heading)
  {
    type: "function",
    function: {
      name: "replace_section",
      description:
        "Replace everything under a Markdown heading, up to the next heading of the same or higher level. The heading line itself is kept; only its body is replaced. Useful for larger structural rewrites without re-sending the whole page.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "Page ID to edit",
          },
          heading: {
            type: "string",
            description:
              "The heading whose section to replace, with or without leading '#'s (e.g. '## Session model' or 'Session model').",
          },
          new_markdown: {
            type: "string",
            description:
              "New markdown body to place under the heading (replaces the existing section body).",
          },
        },
        required: ["id", "heading", "new_markdown"],
      },
    },
  },

  // Append markdown to the end of a page
  {
    type: "function",
    function: {
      name: "append_to_page",
      description:
        "Append a block of markdown to the end of a page, separated from existing content by a blank line. Does not re-send the whole page.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "Page ID to edit",
          },
          markdown: {
            type: "string",
            description: "Markdown to append to the end of the page.",
          },
        },
        required: ["id", "markdown"],
      },
    },
  },

  // Insert markdown immediately after a heading
  {
    type: "function",
    function: {
      name: "insert_after_heading",
      description:
        "Insert a block of markdown immediately after a given heading line, before that section's existing body. Does not re-send the whole page.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "Page ID to edit",
          },
          heading: {
            type: "string",
            description:
              "The heading to insert after, with or without leading '#'s (e.g. '## Session model' or 'Session model').",
          },
          markdown: {
            type: "string",
            description: "Markdown to insert after the heading.",
          },
        },
        required: ["id", "heading", "markdown"],
      },
    },
  },

  // Delete page
  {
    type: "function",
    function: {
      name: "delete_page",
      description: "Delete a page from Wiki.js",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "Page ID to delete",
          },
        },
        required: ["id"],
      },
    },
  },

  // List users
  {
    type: "function",
    function: {
      name: "list_users",
      description: "Get a list of Wiki.js users",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },

  // Search users
  {
    type: "function",
    function: {
      name: "search_users",
      description: "Search users by query in Wiki.js",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query (name or email)",
          },
        },
        required: ["query"],
      },
    },
  },

  // List groups
  {
    type: "function",
    function: {
      name: "list_groups",
      description: "Get a list of Wiki.js user groups",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },

  // Create user
  {
    type: "function",
    function: {
      name: "create_user",
      description: "Create a new user in Wiki.js",
      parameters: {
        type: "object",
        properties: {
          email: {
            type: "string",
            description: "User email",
          },
          name: {
            type: "string",
            description: "User name",
          },
          passwordRaw: {
            type: "string",
            description: "User password (plain text)",
          },
          providerKey: {
            type: "string",
            description:
              "Authentication provider key (default 'local')",
          },
          groups: {
            type: "array",
            items: {
              type: "number",
            },
            description:
              "Array of group IDs to add the user to (default [2])",
          },
          mustChangePassword: {
            type: "boolean",
            description:
              "Require password change on next login (default false)",
          },
          sendWelcomeEmail: {
            type: "boolean",
            description: "Send welcome email (default false)",
          },
        },
        required: ["email", "name", "passwordRaw"],
      },
    },
  },

  // Update user
  {
    type: "function",
    function: {
      name: "update_user",
      description: "Update Wiki.js user information",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "User ID to update",
          },
          name: {
            type: "string",
            description: "New user name",
          },
        },
        required: ["id", "name"],
      },
    },
  },

  // List all pages (including unpublished)
  {
    type: "function",
    function: {
      name: "list_all_pages",
      description:
        "Get a list of all Wiki.js pages including unpublished with optional sorting",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description:
              "Maximum number of pages to return (default 50)",
          },
          orderBy: {
            type: "string",
            description: "Sort field (TITLE, CREATED, UPDATED)",
          },
          includeUnpublished: {
            type: "boolean",
            description:
              "Include unpublished pages (default true)",
          },
        },
        required: [],
      },
    },
  },

  // Search unpublished pages
  {
    type: "function",
    function: {
      name: "search_unpublished_pages",
      description: "Search unpublished pages by query in Wiki.js",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query",
          },
          limit: {
            type: "number",
            description:
              "Maximum number of results (default 10)",
          },
        },
        required: ["query"],
      },
    },
  },

  // Move page to a new path
  {
    type: "function",
    function: {
      name: "move_page",
      description:
        "Move (relocate) a Wiki.js page to a new path/folder. Use this instead of update_page when you need to change the page's location in the wiki tree.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "Page ID to move",
          },
          destinationPath: {
            type: "string",
            description:
              "New path for the page (e.g. 'folder/subfolder/page-slug'). Must not include a leading slash.",
          },
          destinationLocale: {
            type: "string",
            description:
              "Locale for the destination path (e.g. 'en', 'ru'). Defaults to the current page locale if omitted.",
          },
        },
        required: ["id", "destinationPath"],
      },
    },
  },

  // Force delete page (including unpublished)
  {
    type: "function",
    function: {
      name: "force_delete_page",
      description:
        "Force delete a page from Wiki.js (including unpublished pages)",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "Page ID to delete",
          },
        },
        required: ["id"],
      },
    },
  },

  // Get page publication status
  {
    type: "function",
    function: {
      name: "get_page_status",
      description:
        "Get publication status and detailed page information",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "Page ID in Wiki.js",
          },
        },
        required: ["id"],
      },
    },
  },

  // Publish page
  {
    type: "function",
    function: {
      name: "publish_page",
      description: "Publish an unpublished page in Wiki.js",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "Page ID to publish",
          },
        },
        required: ["id"],
      },
    },
  },
];

// Errors that represent expected, user/model-facing validation failures
// (bad input, not-found, non-unique match) rather than server/infra bugs.
// The MCP layer returns these to the client as a normal tool error but does
// NOT report them to Sentry, keeping error monitoring focused on real defects.
export class ExpectedToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpectedToolError";
  }
}

// Wiki.js stores page.description in a varchar(255) column. Longer values are
// silently dropped by the DB (the body still saves, the description does not),
// so we reject them up front with an actionable error instead of reporting a
// false success.
const MAX_DESCRIPTION_LENGTH = 255;

function assertDescriptionWithinLimit(description?: string): void {
  if (description != null && description.length > MAX_DESCRIPTION_LENGTH) {
    throw new ExpectedToolError(
      `description exceeds Wiki.js ${MAX_DESCRIPTION_LENGTH}-char limit: ${description.length}`
    );
  }
}

// --- Markdown helpers for the partial-edit tools ---------------------------
//
// The line-based tools below split content into lines and rejoin with "\n".
// Wiki.js stores page content with LF endings, so this is a no-op for normal
// pages and harmlessly normalizes the rare mixed-ending page to LF.
// (patch_page does a pure substring replace and never touches line endings.)

// Count non-overlapping occurrences of needle in haystack.
function countOccurrences(haystack: string, needle: string): number {
  if (needle === "") return 0;
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count++;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

const HEADING_RE = /^(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/;

interface ParsedHeading {
  level: number;
  text: string;
}

// Parse an ATX markdown heading line ("## Title"); null if the line is not one.
function parseHeading(line: string): ParsedHeading | null {
  const m = HEADING_RE.exec(line);
  if (!m) return null;
  return { level: m[1].length, text: m[2].trim() };
}

// Normalize a heading argument that may be given with or without leading '#'s
// (e.g. "## Session model" or "Session model"). When '#'s are present the level
// is captured and used to disambiguate; otherwise any matching heading text wins.
function normalizeHeadingArg(heading: string): { level?: number; text: string } {
  const parsed = parseHeading(heading.trim());
  if (parsed) return { level: parsed.level, text: parsed.text };
  return { text: heading.trim().replace(/^#+[ \t]*/, "").trim() };
}

// Strip blank (whitespace-only) lines from both ends of a markdown block,
// returning its inner lines. Internal blank lines are preserved. An empty or
// all-blank block yields []. Used to give the partial-edit tools a single
// spacing rule: callers may pass a block with any number of surrounding blank
// lines (0, 1, or many) and the tool re-frames it with exactly one blank line
// against the surrounding headings.
function trimBlankEdges(block: string): string[] {
  const lines = block.split(/\r?\n/);
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === "") start++;
  while (end > start && lines[end - 1].trim() === "") end--;
  return lines.slice(start, end);
}

// Locate the first heading line matching the requested heading; -1 if absent.
function findHeadingIndex(lines: string[], heading: string): number {
  const target = normalizeHeadingArg(heading);
  for (let i = 0; i < lines.length; i++) {
    const parsed = parseHeading(lines[i]);
    if (!parsed) continue;
    if (
      parsed.text === target.text &&
      (target.level === undefined || parsed.level === target.level)
    ) {
      return i;
    }
  }
  return -1;
}

// Wiki.js API base class
class WikiJsAPI {
  private client: GraphQLClient;
  private token: string;
  private baseUrl: string;
  private publicUrl: string;
  private locale: string;
  readonly userId?: number;

  constructor(
    baseUrl: string = "http://localhost:3000",
    token: string = "",
    locale: string = "en",
    publicUrl?: string,
    userId?: number
  ) {
    console.log(
      `[WikiJsAPI] Constructor called. baseUrl: ${baseUrl}, token: ${
        token ? "provided" : "missing"
      }, locale: ${locale}`
    );
    this.client = new GraphQLClient(`${baseUrl}/graphql`);
    this.token = token;
    this.baseUrl = baseUrl;
    // Use explicit publicUrl, fall back to the module-level WIKIJS_PUBLIC_URL constant
    this.publicUrl = publicUrl || WIKIJS_PUBLIC_URL;
    this.locale = locale;
    this.userId = userId;

    if (token) {
      console.log("[WikiJsAPI] Setting Authorization header.");
      this.client.setHeader("Authorization", `Bearer ${token}`);
    }
  }

  // Generate page URL using the public hostname so links work outside Docker
  private generatePageUrl(path: string): string {
    return generatePageUrl(this.publicUrl, this.locale, path);
  }

  // Get page by ID
  async getPage(id: number): Promise<WikiJsPage> {
    console.log(`[WikiJsAPI] getPage called with id: ${id}`);
    const query = gql`
      query GetPage($id: Int!) {
        pages {
          single(id: $id) {
            id
            path
            title
            description
            createdAt
            updatedAt
          }
        }
      }
    `;

    const variables = { id };
    console.log(
      `[WikiJsAPI] getPage: sending GraphQL request with variables: ${JSON.stringify(
        variables
      )}`
    );
    try {
      const data = await this.client.request<PageResponse>(query, variables);
      console.log("[WikiJsAPI] getPage: request completed successfully.");
      const page = data.pages.single;
      return {
        ...page,
        url: this.generatePageUrl(page.path),
      };
    } catch (error) {
      console.error(
        `[WikiJsAPI] getPage: GraphQL request error: ${error}`,
        error
      );
      throw error;
    }
  }

  // Get page content by ID
  async getPageContent(id: number): Promise<string> {
    console.log(`[WikiJsAPI] getPageContent called with id: ${id}`);
    const query = gql`
      query GetPageContent($id: Int!) {
        pages {
          single(id: $id) {
            content
          }
        }
      }
    `;

    const variables = { id };
    console.log(
      `[WikiJsAPI] getPageContent: sending GraphQL request with variables: ${JSON.stringify(
        variables
      )}`
    );
    try {
      const data = await this.client.request<PageContentResponse>(
        query,
        variables
      );
      console.log("[WikiJsAPI] getPageContent: request completed successfully.");
      return data.pages.single.content;
    } catch (error) {
      console.error(
        `[WikiJsAPI] getPageContent: GraphQL request error: ${error}`,
        error
      );
      throw error;
    }
  }

  // Get page content via HTTP (alternative method)
  async getPageContentViaHTTP(path: string): Promise<string> {
    console.log(`[WikiJsAPI] getPageContentViaHTTP called with path: ${path}`);
    const url = this.generatePageUrl(path);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // Extract text content from HTML
      // Look for content in <template slot="contents"> block
      const contentRegex =
        /<template[^>]*slot="contents"[^>]*>([\s\S]*?)<\/template>/i;
      const match = html.match(contentRegex);

      if (match) {
        // Remove HTML tags and decode entities
        return match[1]
          .replace(/<[^>]*>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&")
          .replace(/\s+/g, " ")
          .trim();
      }

      // If content not found in template block, try extracting all text
      return html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim();
    } catch (error) {
      console.error(
        `[WikiJsAPI] getPageContentViaHTTP: HTTP request error: ${error}`
      );
      throw error;
    }
  }

  // List pages
  async listPages(
    limit: number = 50,
    orderBy: string = "TITLE"
  ): Promise<WikiJsPage[]> {
    console.log(
      `[WikiJsAPI] listPages called with limit: ${limit}, orderBy: ${orderBy}`
    );
    const query = gql`
      query ListPages($limit: Int, $orderBy: PageOrderBy) {
        pages {
          list(limit: $limit, orderBy: $orderBy) {
            id
            path
            title
            description
            createdAt
            updatedAt
          }
        }
      }
    `;

    const variables = { limit, orderBy };
    console.log(
      `[WikiJsAPI] listPages: sending GraphQL request with variables: ${JSON.stringify(
        variables
      )}`
    );
    try {
      const data = await this.client.request<PagesListResponse>(
        query,
        variables
      );
      console.log("[WikiJsAPI] listPages: request completed successfully.");
      return data.pages.list.map((page) => ({
        ...page,
        url: this.generatePageUrl(page.path),
      }));
    } catch (error) {
      console.error(
        `[WikiJsAPI] listPages: GraphQL request error: ${error}`,
        error
      );
      throw error;
    }
  }

  // Search pages (enhanced: by content and titles)
  async searchPages(query: string, limit: number = 10): Promise<WikiJsPage[]> {
    console.log(
      `[WikiJsAPI] searchPages called with query: ${query}, limit: ${limit}`
    );

    const results: WikiJsPage[] = [];
    const foundIds = new Set<number>();

    // 1. Search via GraphQL API (works on content index)
    try {
      const gqlQuery = gql`
        query SearchPages($query: String!) {
          pages {
            search(query: $query) {
              results {
                id
                title
                description
                path
                locale
              }
              suggestions
              totalHits
            }
          }
        }
      `;

      const variables = { query };
      console.log(
        `[WikiJsAPI] searchPages: sending GraphQL search with variables: ${JSON.stringify(
          variables
        )}`
      );

      const data = await this.client.request<PagesSearchResponse>(
        gqlQuery,
        variables
      );
      console.log(
        `[WikiJsAPI] searchPages: GraphQL search returned ${data.pages.search.results.length} results`
      );

      // Add results from GraphQL search
      data.pages.search.results.forEach((result) => {
        const id = parseInt(result.id, 10);
        if (!foundIds.has(id)) {
          foundIds.add(id);
          results.push({
            id,
            path: result.path,
            title: result.title,
            description: result.description || "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            url: this.generatePageUrl(result.path),
          });
        }
      });
    } catch (error) {
      console.warn(
        `[WikiJsAPI] searchPages: GraphQL search failed: ${error}`
      );
    }

    // 2. Search by titles via listPages (extended limit for search)
    try {
      console.log(
        `[WikiJsAPI] searchPages: searching by titles via listPages`
      );
      const allPages = await this.listPages(200, "UPDATED");
      const queryLower = query.toLowerCase();

      const titleMatches = allPages.filter((page) => {
        const titleMatch = page.title.toLowerCase().includes(queryLower);
        const pathMatch = page.path.toLowerCase().includes(queryLower);
        const descMatch = page.description?.toLowerCase().includes(queryLower);

        return (titleMatch || pathMatch || descMatch) && !foundIds.has(page.id);
      });

      console.log(
        `[WikiJsAPI] searchPages: found ${titleMatches.length} additional matches by titles/paths`
      );

      titleMatches.forEach((page) => {
        if (!foundIds.has(page.id)) {
          foundIds.add(page.id);
          results.push(page);
        }
      });
    } catch (error) {
      console.warn(
        `[WikiJsAPI] searchPages: title search failed: ${error}`
      );
    }

    // 3. Search by page content via HTTP (alternative method)
    if (results.length < 3 && query.length > 2) {
      try {
        console.log(
          `[WikiJsAPI] searchPages: searching by content via HTTP`
        );
        const searchLimit = Math.min(30, limit * 3);
        const recentPages = await this.listPages(searchLimit, "UPDATED");

        for (const page of recentPages) {
          if (foundIds.has(page.id)) continue;

          try {
            // Try GraphQL first
            let content = "";
            try {
              content = await this.getPageContent(page.id);
            } catch (graphqlError) {
              // If GraphQL failed, use HTTP
              content = await this.getPageContentViaHTTP(page.path);
            }

            if (content.toLowerCase().includes(query.toLowerCase())) {
              console.log(
                `[WikiJsAPI] searchPages: found match in page content ${page.id}: ${page.title}`
              );
              foundIds.add(page.id);
              results.push(page);

              if (results.length >= limit) break;
            }
          } catch (contentError) {
            console.warn(
              `[WikiJsAPI] searchPages: failed to get page content ${page.id}: ${contentError}`
            );
          }
        }
      } catch (error) {
        console.warn(
          `[WikiJsAPI] searchPages: content search failed: ${error}`
        );
      }
    }

    // 4. Additional search on known pages (if main methods didn't work)
    if (results.length === 0 && query.length > 2) {
      console.log(
        `[WikiJsAPI] searchPages: trying search on known pages with ID 103-110`
      );
      const knownPageIds = [103, 104, 105, 106, 107, 108, 109, 110];

      for (const pageId of knownPageIds) {
        if (foundIds.has(pageId)) continue;

        try {
          // Get page metadata
          const page = await this.getPage(pageId);

          // Get content via HTTP
          const content = await this.getPageContentViaHTTP(page.path);

          if (content.toLowerCase().includes(query.toLowerCase())) {
            console.log(
              `[WikiJsAPI] searchPages: found match in known page ${page.id}: ${page.title}`
            );
            foundIds.add(page.id);
            results.push(page);

            if (results.length >= limit) break;
          }
        } catch (error) {
          console.warn(
            `[WikiJsAPI] searchPages: error checking known page ${pageId}: ${error}`
          );
        }
      }
    }

    console.log(
      `[WikiJsAPI] searchPages: total result: ${results.length} pages found`
    );

    // Limit results to requested limit
    return limit > 0 ? results.slice(0, limit) : results;
  }

  // Create page
  async createPage(
    title: string,
    content: string,
    path: string,
    description: string = "",
    tags: string[] = ["mcp", "test"],
    isPublished: boolean = true
  ): Promise<WikiJsPage> {
    console.log(
      `[WikiJsAPI] createPage called with title: ${title}, path: ${path}, description: ${description}, tags: ${tags.join(
        ", "
      )}, isPublished: ${isPublished}`
    );
    assertDescriptionWithinLimit(description);
    const mutation = gql`
      mutation CreatePage(
        $content: String!
        $description: String!
        $editor: String!
        $isPublished: Boolean!
        $isPrivate: Boolean!
        $locale: String!
        $path: String!
        $publishEndDate: Date
        $publishStartDate: Date
        $scriptCss: String
        $scriptJs: String
        $tags: [String]!
        $title: String!
      ) {
        pages {
          create(
            content: $content
            description: $description
            editor: $editor
            isPublished: $isPublished
            isPrivate: $isPrivate
            locale: $locale
            path: $path
            publishEndDate: $publishEndDate
            publishStartDate: $publishStartDate
            scriptCss: $scriptCss
            scriptJs: $scriptJs
            tags: $tags
            title: $title
          ) {
            responseResult {
              succeeded
              slug
              message
            }
            page {
              id
              path
              title
              description
              createdAt
              updatedAt
            }
          }
        }
      }
    `;

    const variables = {
      content,
      description: description || "",
      editor: "markdown",
      isPublished,
      isPrivate: false,
      locale: this.locale,
      path,
      tags: tags,
      title,
    };

    console.log(
      `[WikiJsAPI] createPage: sending GraphQL mutation with variables: ${JSON.stringify(
        variables
      )}`
    );
    try {
      const data = await this.client.request<PageCreateResponse>(
        mutation,
        variables
      );
      console.log("[WikiJsAPI] createPage: mutation completed successfully.");
      if (!data.pages.create.responseResult.succeeded) {
        throw new Error(
          `Page creation error: ${
            data.pages.create.responseResult.message || "Unknown error"
          }`
        );
      }
      const page = data.pages.create.page;
      if (this.userId) {
        fixPageAuthor(page.id, this.userId).then(() => flushWikiCache()).catch(() => {});
      }
      return {
        ...page,
        url: this.generatePageUrl(page.path),
      };
    } catch (error) {
      console.error(
        `[WikiJsAPI] createPage: GraphQL mutation error: ${error}`,
        error
      );
      throw error;
    }
  }

  // Update page
  async updatePage(
    id: number,
    content: string,
    title?: string,
    description?: string
  ): Promise<WikiJsPage> {
    console.log(
      `[WikiJsAPI] updatePage called with id: ${id}, title: ${title ?? "(unchanged)"}, description: ${
        description ?? "(unchanged)"
      }`
    );

    // Validate before any network round-trip so an over-long description fails
    // loudly instead of being silently truncated/dropped by the DB.
    assertDescriptionWithinLimit(description);

    // Fetch current page metadata first — the Wiki.js update mutation requires
    // all fields to be present, otherwise it saves content silently without
    // creating a history entry or updating "last edited by".
    const metaQuery = gql`
      query GetPageMeta($id: Int!) {
        pages {
          single(id: $id) {
            title
            description
            editor
            locale
            isPublished
            tags { tag }
          }
        }
      }
    `;
    const metaData: any = await this.client.request(metaQuery, { id });
    const meta = metaData.pages.single;
    const tags = (meta.tags || []).map((t: any) => t.tag);

    const mutation = gql`
      mutation UpdatePage(
        $id: Int!
        $content: String!
        $title: String!
        $description: String!
        $editor: String!
        $locale: String!
        $isPublished: Boolean!
        $tags: [String]!
      ) {
        pages {
          update(
            id: $id
            content: $content
            title: $title
            description: $description
            editor: $editor
            locale: $locale
            isPublished: $isPublished
            tags: $tags
          ) {
            responseResult {
              succeeded
              slug
              message
            }
            page {
              id
              path
              title
              description
              updatedAt
            }
          }
        }
      }
    `;

    const variables: Record<string, any> = {
      id,
      content,
      title: title ?? meta.title,
      description: description ?? meta.description ?? "",
      editor: meta.editor || "markdown",
      locale: meta.locale || "en",
      isPublished: meta.isPublished ?? true,
      tags,
    };
    console.log(
      `[WikiJsAPI] updatePage: sending GraphQL mutation with variables: ${JSON.stringify(
        { ...variables, content: "[omitted]" }
      )}`
    );
    try {
      const data = await this.client.request<PageUpdateResponse>(
        mutation,
        variables
      );
      console.log("[WikiJsAPI] updatePage: mutation completed successfully.");

      if (!data.pages.update || !data.pages.update.page) {
        console.log(
          "[WikiJsAPI] updatePage: page not returned, possibly insufficient permissions"
        );
        if (this.userId) {
          fixPageAuthor(id, this.userId).then(() => flushWikiCache()).catch(() => {});
        }
        return await this.getPage(id);
      }

      const page = data.pages.update.page;
      if (this.userId) {
        fixPageAuthor(page.id, this.userId).then(() => flushWikiCache()).catch(() => {});
      }
      return {
        ...page,
        url: this.generatePageUrl(page.path),
      };
    } catch (error) {
      console.error(
        `[WikiJsAPI] updatePage: GraphQL mutation error: ${error}`,
        error
      );
      throw error;
    }
  }

  // Content-anchored find/replace, mirroring the Claude Code Edit tool.
  //
  // Fetches the page's current stored content (the same bytes get_page_content
  // returns), replaces old_string with new_string, and writes the full merged
  // content back via the normal update path. Only the small diff crosses the
  // client↔MCP boundary; the full page travels solely MCP↔Wiki.js, keeping it
  // out of the model's context.
  //
  // old_string is matched by exact content (NOT by line number) and may be
  // multi-line. If it occurs more than once the call errors unless replaceAll
  // is set; if it is absent the call errors. Everything else is preserved
  // byte-for-byte.
  //
  // NOTE: Wiki.js has no partial-update API, so this is a fetch→modify→full-PUT
  // and carries a small TOCTOU window if another writer edits the page between
  // the read and the write. Low risk for our usage; the underlying update
  // mutation offers no version/checksum guard to close it.
  async patchPage(
    id: number,
    oldString: string,
    newString: string,
    replaceAll: boolean = false
  ): Promise<WikiJsPage> {
    console.log(
      `[WikiJsAPI] patchPage called with id: ${id}, replaceAll: ${replaceAll}`
    );
    if (oldString === "") {
      throw new ExpectedToolError("patch_page: old_string must not be empty");
    }
    if (oldString === newString) {
      throw new ExpectedToolError(
        "patch_page: old_string and new_string are identical; nothing to change"
      );
    }

    const content = await this.getPageContent(id);
    const count = countOccurrences(content, oldString);

    if (count === 0) {
      throw new ExpectedToolError(
        `patch_page: old_string not found in page ${id}. It must match the stored content exactly, including whitespace and line breaks.`
      );
    }
    if (count > 1 && !replaceAll) {
      throw new ExpectedToolError(
        `patch_page: old_string is not unique in page ${id} (found ${count} occurrences). Add more surrounding context to make it unique, or pass replace_all: true.`
      );
    }

    // split/join replaces every occurrence and — unlike String.prototype.replace
    // — never interprets '$' sequences in new_string. For the unique case
    // (count === 1) this performs exactly one replacement.
    const newContent = content.split(oldString).join(newString);

    return await this.updatePage(id, newContent);
  }

  // Replace everything under a given Markdown heading, up to the next heading of
  // the same or higher level. The heading line itself is preserved; only its
  // body is swapped for newMarkdown. heading may be passed with or without its
  // leading '#'s (e.g. "## Session model" or "Session model").
  async replaceSection(
    id: number,
    heading: string,
    newMarkdown: string
  ): Promise<WikiJsPage> {
    console.log(
      `[WikiJsAPI] replaceSection called with id: ${id}, heading: ${heading}`
    );
    const content = await this.getPageContent(id);
    const lines = content.split(/\r?\n/);

    const headingIdx = findHeadingIndex(lines, heading);
    if (headingIdx === -1) {
      throw new ExpectedToolError(
        `replace_section: heading "${heading}" not found in page ${id}.`
      );
    }
    const headingLevel = parseHeading(lines[headingIdx])!.level;

    // The section ends at the next heading of the same or higher level (smaller
    // or equal '#' count), or at end-of-document.
    let endIdx = lines.length;
    for (let i = headingIdx + 1; i < lines.length; i++) {
      const parsed = parseHeading(lines[i]);
      if (parsed && parsed.level <= headingLevel) {
        endIdx = i;
        break;
      }
    }

    // Re-frame the replacement body with exactly one blank line on each side:
    // strip any blank lines the caller left on the edges, then add a single
    // blank line between the heading above and the body, and another between the
    // body and the next heading below. The next-heading blank is omitted when
    // this section runs to end-of-document (endIdx === lines.length), so we don't
    // leave a dangling blank line at EOF.
    const body = trimBlankEdges(newMarkdown);
    const after = lines.slice(endIdx);
    const middle: string[] = [];
    if (body.length > 0) middle.push("", ...body);
    if (after.length > 0) middle.push("");

    const newLines = [...lines.slice(0, headingIdx + 1), ...middle, ...after];

    return await this.updatePage(id, newLines.join("\n"));
  }

  // Append a block of markdown to the end of the page, separated from existing
  // content by a blank line.
  async appendToPage(id: number, markdown: string): Promise<WikiJsPage> {
    console.log(`[WikiJsAPI] appendToPage called with id: ${id}`);
    const content = await this.getPageContent(id);
    const trimmed = content.replace(/[\r\n]+$/, "");
    const newContent = trimmed.length > 0 ? `${trimmed}\n\n${markdown}` : markdown;
    return await this.updatePage(id, newContent);
  }

  // Insert a block of markdown immediately after a given heading line, before
  // that section's existing body.
  async insertAfterHeading(
    id: number,
    heading: string,
    markdown: string
  ): Promise<WikiJsPage> {
    console.log(
      `[WikiJsAPI] insertAfterHeading called with id: ${id}, heading: ${heading}`
    );
    const content = await this.getPageContent(id);
    const lines = content.split(/\r?\n/);

    const headingIdx = findHeadingIndex(lines, heading);
    if (headingIdx === -1) {
      throw new ExpectedToolError(
        `insert_after_heading: heading "${heading}" not found in page ${id}.`
      );
    }

    // Frame the inserted block with exactly one blank line above (against the
    // heading) and one below (against the section's existing body). Strip blank
    // lines the caller left on the block's edges, and drop any leading blank
    // lines the existing body already had so our single separator isn't doubled.
    const block = trimBlankEdges(markdown);
    const rest = lines.slice(headingIdx + 1);
    let r = 0;
    while (r < rest.length && rest[r].trim() === "") r++;
    const restBody = rest.slice(r);

    const middle: string[] = [];
    if (block.length > 0) middle.push("", ...block);
    if (restBody.length > 0) middle.push("", ...restBody);

    const newLines = [...lines.slice(0, headingIdx + 1), ...middle];

    return await this.updatePage(id, newLines.join("\n"));
  }

  // Delete page
  async deletePage(
    id: number
  ): Promise<{ success: boolean; message: string | undefined }> {
    console.log(`[WikiJsAPI] deletePage called with id: ${id}`);
    const mutation = gql`
      mutation DeletePage($id: Int!) {
        pages {
          delete(id: $id) {
            responseResult {
              succeeded
              slug
              message
            }
          }
        }
      }
    `;

    const variables = { id };
    console.log(
      `[WikiJsAPI] deletePage: sending GraphQL mutation with variables: ${JSON.stringify(
        variables
      )}`
    );
    try {
      const data = await this.client.request<PageDeleteResponse>(
        mutation,
        variables
      );
      console.log("[WikiJsAPI] deletePage: mutation completed successfully.");
      return {
        success: data.pages.delete.responseResult.succeeded,
        message: data.pages.delete.responseResult.message,
      };
    } catch (error) {
      console.error(
        `[WikiJsAPI] deletePage: GraphQL mutation error: ${error}`,
        error
      );
      throw error;
    }
  }

  // Move page to a new path
  async movePage(
    id: number,
    destinationPath: string,
    destinationLocale?: string
  ): Promise<{ success: boolean; message: string | undefined; page?: WikiJsPage }> {
    console.log(
      `[WikiJsAPI] movePage called with id: ${id}, destinationPath: ${destinationPath}, destinationLocale: ${destinationLocale}`
    );

    // Resolve locale: use provided value, or fall back to the page's current locale
    let locale = destinationLocale;
    if (!locale) {
      const metaQuery = gql`
        query GetPageLocale($id: Int!) {
          pages {
            single(id: $id) {
              locale
            }
          }
        }
      `;
      const metaData: any = await this.client.request(metaQuery, { id });
      locale = metaData.pages.single.locale || this.locale;
    }

    const mutation = gql`
      mutation MovePage($id: Int!, $destinationPath: String!, $destinationLocale: String!) {
        pages {
          move(id: $id, destinationPath: $destinationPath, destinationLocale: $destinationLocale) {
            responseResult {
              succeeded
              errorCode
              slug
              message
            }
          }
        }
      }
    `;

    const variables = { id, destinationPath, destinationLocale: locale };
    console.log(
      `[WikiJsAPI] movePage: sending GraphQL mutation with variables: ${JSON.stringify(variables)}`
    );
    try {
      const data = await this.client.request<PageMoveResponse>(mutation, variables);
      console.log("[WikiJsAPI] movePage: mutation completed successfully.");
      const result = data.pages.move.responseResult;
      if (!result.succeeded) {
        return { success: false, message: result.message };
      }
      // Fetch updated page so we can return the new URL
      const page = await this.getPage(id);
      return { success: true, message: result.message, page };
    } catch (error) {
      console.error(`[WikiJsAPI] movePage: GraphQL mutation error: ${error}`, error);
      throw error;
    }
  }

  // List users
  async listUsers(): Promise<WikiJsUser[]> {
    console.log("[WikiJsAPI] listUsers called.");
    const query = gql`
      query ListUsers {
        users {
          list {
            id
            name
            email
            isActive
            createdAt
          }
        }
      }
    `;
    console.log("[WikiJsAPI] listUsers: sending GraphQL request.");
    try {
      const data = await this.client.request<UsersListResponse>(query);
      console.log("[WikiJsAPI] listUsers: request completed successfully.");
      return data.users.list;
    } catch (error) {
      console.error(
        `[WikiJsAPI] listUsers: GraphQL request error: ${error}`,
        error
      );
      throw error;
    }
  }

  // Search users
  async searchUsers(query: string): Promise<WikiJsUser[]> {
    console.log(`[WikiJsAPI] searchUsers called with query: ${query}`);
    const gqlQuery = gql`
      query SearchUsers($query: String!) {
        users {
          search(query: $query) {
            id
            name
            email
            isActive
            createdAt
          }
        }
      }
    `;

    const variables = { query };
    console.log(
      `[WikiJsAPI] searchUsers: sending GraphQL request with variables: ${JSON.stringify(
        variables
      )}`
    );
    try {
      const data = await this.client.request<UsersSearchResponse>(
        gqlQuery,
        variables
      );
      console.log("[WikiJsAPI] searchUsers: request completed successfully.");
      return data.users.search;
    } catch (error) {
      console.error(
        `[WikiJsAPI] searchUsers: GraphQL request error: ${error}`,
        error
      );
      throw error;
    }
  }

  // List groups
  async listGroups(): Promise<WikiJsGroup[]> {
    console.log("[WikiJsAPI] listGroups called.");
    const query = gql`
      query ListGroups {
        groups {
          list {
            id
            name
            isSystem
            createdAt
          }
        }
      }
    `;
    console.log("[WikiJsAPI] listGroups: sending GraphQL request.");
    try {
      const data = await this.client.request<GroupsListResponse>(query);
      console.log("[WikiJsAPI] listGroups: request completed successfully.");
      return data.groups.list;
    } catch (error) {
      console.error(
        `[WikiJsAPI] listGroups: GraphQL request error: ${error}`,
        error
      );
      throw error;
    }
  }

  // Create user
  async createUser(
    email: string,
    name: string,
    passwordRaw: string,
    providerKey: string = "local",
    groups: number[] = [2],
    mustChangePassword: boolean = false,
    sendWelcomeEmail: boolean = false
  ): Promise<WikiJsUser> {
    console.log(
      `[WikiJsAPI] createUser called with email: ${email}, name: ${name}`
    );
    const mutation = gql`
      mutation CreateUser(
        $email: String!
        $name: String!
        $passwordRaw: String!
        $providerKey: String!
        $groups: [Int]!
        $mustChangePassword: Boolean!
        $sendWelcomeEmail: Boolean!
      ) {
        users {
          create(
            email: $email
            name: $name
            passwordRaw: $passwordRaw
            providerKey: $providerKey
            groups: $groups
            mustChangePassword: $mustChangePassword
            sendWelcomeEmail: $sendWelcomeEmail
          ) {
            id
            name
            email
            providerKey
            isActive
            createdAt
            updatedAt
          }
        }
      }
    `;

    const variables = {
      email,
      name,
      passwordRaw,
      providerKey,
      groups,
      mustChangePassword,
      sendWelcomeEmail,
    };

    console.log(
      `[WikiJsAPI] createUser: sending GraphQL mutation with variables: ${JSON.stringify(
        variables
      )}`
    );
    try {
      const data = await this.client.request<UserCreateResponse>(
        mutation,
        variables
      );
      console.log("[WikiJsAPI] createUser: mutation completed successfully.");
      return data.users.create;
    } catch (error) {
      console.error(
        `[WikiJsAPI] createUser: GraphQL mutation error: ${error}`,
        error
      );
      throw error;
    }
  }

  // Update user
  async updateUser(id: number, name: string): Promise<WikiJsUser> {
    console.log(`[WikiJsAPI] updateUser called with id: ${id}, name: ${name}`);
    const mutation = gql`
      mutation UpdateUser($id: Int!, $name: String!) {
        users {
          update(id: $id, name: $name) {
            id
            name
            email
            isActive
            updatedAt
          }
        }
      }
    `;

    const variables = { id, name };
    console.log(
      `[WikiJsAPI] updateUser: sending GraphQL mutation with variables: ${JSON.stringify(
        variables
      )}`
    );
    try {
      const data = await this.client.request<UserUpdateResponse>(
        mutation,
        variables
      );
      console.log("[WikiJsAPI] updateUser: mutation completed successfully.");
      return data.users.update;
    } catch (error) {
      console.error(
        `[WikiJsAPI] updateUser: GraphQL mutation error: ${error}`,
        error
      );
      throw error;
    }
  }

  // List all pages including unpublished
  async listAllPages(
    limit: number = 50,
    orderBy: string = "TITLE",
    includeUnpublished: boolean = true
  ): Promise<(WikiJsPage & { isPublished: boolean })[]> {
    console.log(
      `[WikiJsAPI] listAllPages called with limit: ${limit}, orderBy: ${orderBy}, includeUnpublished: ${includeUnpublished}`
    );
    const query = gql`
      query ListAllPages($limit: Int, $orderBy: PageOrderBy) {
        pages {
          list(limit: $limit, orderBy: $orderBy) {
            id
            path
            title
            description
            createdAt
            updatedAt
            isPublished
          }
        }
      }
    `;

    const variables = { limit, orderBy };
    console.log(
      `[WikiJsAPI] listAllPages: sending GraphQL request with variables: ${JSON.stringify(
        variables
      )}`
    );
    try {
      interface AllPagesListResponse {
        pages: {
          list: (WikiJsPage & { isPublished: boolean })[];
        };
      }

      const data = await this.client.request<AllPagesListResponse>(
        query,
        variables
      );
      console.log("[WikiJsAPI] listAllPages: request completed successfully.");

      let pages = data.pages.list;

      // Filter by publication status if needed
      if (!includeUnpublished) {
        pages = pages.filter((page) => page.isPublished);
      }

      return pages.map((page) => ({
        ...page,
        url: this.generatePageUrl(page.path),
      }));
    } catch (error) {
      console.error(
        `[WikiJsAPI] listAllPages: GraphQL request error: ${error}`,
        error
      );
      throw error;
    }
  }

  // Search unpublished pages
  async searchUnpublishedPages(
    query: string,
    limit: number = 10
  ): Promise<(WikiJsPage & { isPublished: boolean })[]> {
    console.log(
      `[WikiJsAPI] searchUnpublishedPages called with query: ${query}, limit: ${limit}`
    );

    try {
      const allPages = await this.listAllPages(200, "UPDATED", true);

      // Filter only unpublished pages
      const unpublishedPages = allPages.filter((page) => !page.isPublished);

      // Search by query in title, path or description
      const queryLower = query.toLowerCase();
      const matches = unpublishedPages.filter((page) => {
        const titleMatch = page.title.toLowerCase().includes(queryLower);
        const pathMatch = page.path.toLowerCase().includes(queryLower);
        const descMatch = page.description?.toLowerCase().includes(queryLower);

        return titleMatch || pathMatch || descMatch;
      });

      console.log(
        `[WikiJsAPI] searchUnpublishedPages: found ${matches.length} unpublished pages`
      );

      return matches.slice(0, limit);
    } catch (error) {
      console.error(
        `[WikiJsAPI] searchUnpublishedPages: search error: ${error}`,
        error
      );
      throw error;
    }
  }

  // Force delete page (including unpublished)
  async forceDeletePage(
    id: number
  ): Promise<{ success: boolean; message: string | undefined }> {
    console.log(`[WikiJsAPI] forceDeletePage called with id: ${id}`);

    // Try regular deletion first
    try {
      return await this.deletePage(id);
    } catch (error) {
      console.warn(
        `[WikiJsAPI] forceDeletePage: regular deletion failed, trying alternative methods: ${error}`
      );
    }

    // If regular deletion failed, try alternative methods
    const mutations = [
      // Try deleting with additional parameters
      gql`
        mutation ForceDeletePage($id: Int!) {
          pages {
            delete(id: $id, purge: true) {
              responseResult {
                succeeded
                errorCode
                message
              }
            }
          }
        }
      `,
      // Try render mutation for deletion
      gql`
        mutation DeletePageRender($id: Int!) {
          pages {
            render(id: $id, mode: DELETE) {
              responseResult {
                succeeded
                errorCode
                message
              }
            }
          }
        }
      `,
      // Alternative delete mutation
      gql`
        mutation AlternativeDelete($id: Int!) {
          pages {
            deletePage(id: $id) {
              responseResult {
                succeeded
                errorCode
                message
              }
            }
          }
        }
      `,
    ];

    for (const [index, mutation] of mutations.entries()) {
      try {
        console.log(
          `[WikiJsAPI] forceDeletePage: attempt ${
            index + 1
          } to delete page ${id}`
        );

        const variables = { id };
        const data = await this.client.request<PageDeleteResponse>(
          mutation,
          variables
        );

        if (data.pages.delete?.responseResult?.succeeded) {
          console.log(
            `[WikiJsAPI] forceDeletePage: page ${id} successfully deleted on attempt ${
              index + 1
            }`
          );
          return {
            success: true,
            message: data.pages.delete.responseResult.message,
          };
        }
      } catch (error) {
        console.warn(
          `[WikiJsAPI] forceDeletePage: attempt ${
            index + 1
          } failed: ${error}`
        );
      }
    }

    // If all attempts failed, return error
    const errorMessage = `Failed to delete page ${id} using any available method`;
    console.error(`[WikiJsAPI] forceDeletePage: ${errorMessage}`);
    return {
      success: false,
      message: errorMessage,
    };
  }

  // Get page publication status
  async getPageStatus(
    id: number
  ): Promise<WikiJsPage & { isPublished: boolean }> {
    console.log(`[WikiJsAPI] getPageStatus called with id: ${id}`);
    const query = gql`
      query GetPageStatus($id: Int!) {
        pages {
          single(id: $id) {
            id
            path
            title
            description
            createdAt
            updatedAt
            isPublished
          }
        }
      }
    `;

    const variables = { id };
    console.log(
      `[WikiJsAPI] getPageStatus: sending GraphQL request with variables: ${JSON.stringify(
        variables
      )}`
    );
    try {
      interface PageStatusResponse {
        pages: {
          single: WikiJsPage & { isPublished: boolean };
        };
      }

      const data = await this.client.request<PageStatusResponse>(
        query,
        variables
      );
      console.log("[WikiJsAPI] getPageStatus: request completed successfully.");
      const page = data.pages.single;
      return {
        ...page,
        url: this.generatePageUrl(page.path),
      };
    } catch (error) {
      console.error(
        `[WikiJsAPI] getPageStatus: GraphQL request error: ${error}`,
        error
      );
      throw error;
    }
  }

  // Publish page
  async publishPage(
    id: number
  ): Promise<{ success: boolean; message: string | undefined }> {
    console.log(`[WikiJsAPI] publishPage called with id: ${id}`);
    const mutation = gql`
      mutation PublishPage($id: Int!) {
        pages {
          render(id: $id) {
            responseResult {
              succeeded
              errorCode
              message
            }
          }
        }
      }
    `;

    const variables = { id };
    console.log(
      `[WikiJsAPI] publishPage: sending GraphQL mutation with variables: ${JSON.stringify(
        variables
      )}`
    );
    try {
      interface PublishPageResponse {
        pages: {
          render: {
            responseResult: ResponseResult;
          };
        };
      }

      const data = await this.client.request<PublishPageResponse>(
        mutation,
        variables
      );
      console.log("[WikiJsAPI] publishPage: mutation completed successfully.");

      const result = data.pages.render.responseResult;
      return {
        success: result.succeeded,
        message: result.message,
      };
    } catch (error) {
      console.error(
        `[WikiJsAPI] publishPage: GraphQL mutation error: ${error}`,
        error
      );
      return {
        success: false,
        message: `Page publication error: ${error}`,
      };
    }
  }
}

// Create API client for internal module use
const WIKIJS_BASE_URL = process.env.WIKIJS_BASE_URL || "http://localhost:3000";
const WIKIJS_TOKEN = process.env.WIKIJS_TOKEN || "";
const WIKIJS_LOCALE = process.env.WIKIJS_LOCALE || "en";

// Admin client used only for post-mutation cache flush (requires full-access token).
const adminFlushClient = new GraphQLClient(`${WIKIJS_BASE_URL}/graphql`, {
  headers: {
    Authorization: `Bearer ${process.env.WIKIJS_ADMIN_TOKEN || WIKIJS_TOKEN}`,
  },
});

async function flushWikiCache(): Promise<void> {
  try {
    const mutation = gql`mutation { pages { flushCache { responseResult { succeeded } } } }`;
    await adminFlushClient.request(mutation);
    console.log("[WikiJsAPI] Page cache flushed after author patch");
  } catch (err: any) {
    console.error("[WikiJsAPI] Cache flush failed (non-fatal):", err.message);
  }
}
// Public URL used in page links returned to clients. Falls back to WIKIJS_BASE_URL
// so existing deployments work without change, but set WIKIJS_PUBLIC_URL to the
// public hostname (e.g. https://knb.bulksource.com) so Claude Desktop can open links.
const WIKIJS_PUBLIC_URL =
  process.env.WIKIJS_PUBLIC_URL ||
  process.env.WIKIJS_BASE_URL ||
  "http://localhost:3000";

// Generate page URL
function generatePageUrl(
  baseUrl: string,
  locale: string,
  path: string
): string {
  // Remove trailing slash from base URL if present
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  // Remove leading slash from path if present
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${cleanBaseUrl}/${locale}/${cleanPath}`;
}

const defaultApi = new WikiJsAPI(WIKIJS_BASE_URL, WIKIJS_TOKEN, WIKIJS_LOCALE);

// Factory: create tool implementations bound to a specific WikiJsAPI instance
export function createToolImplementations(api: WikiJsAPI): Record<string, (params: any) => Promise<any>> {
  return {
    get_page: async (params: any) => {
      console.log(`[Implementations] get_page called with params: ${JSON.stringify(params)}`);
      return await api.getPage(params.id);
    },
    get_page_content: async (params: any) => {
      console.log(`[Implementations] get_page_content called with params: ${JSON.stringify(params)}`);
      return await api.getPageContent(params.id);
    },
    list_pages: async (params: any) => {
      console.log(`[Implementations] list_pages called with params: ${JSON.stringify(params)}`);
      return await api.listPages(params.limit, params.orderBy);
    },
    search_pages: async (params: any) => {
      console.log(`[Implementations] search_pages called with params: ${JSON.stringify(params)}`);
      return await api.searchPages(params.query, params.limit);
    },
    create_page: async (params: any) => {
      console.log(`[Implementations] create_page called with params: ${JSON.stringify(params)}`);
      return await api.createPage(
        params.title, params.content, params.path,
        params.description, params.tags || ["mcp", "test"],
        params.published !== undefined ? params.published : true
      );
    },
    update_page: async (params: any) => {
      console.log(`[Implementations] update_page called with params: ${JSON.stringify(params)}`);
      return await api.updatePage(
        params.id,
        params.content,
        params.title,
        params.description
      );
    },
    patch_page: async (params: any) => {
      console.log(`[Implementations] patch_page called with params: ${JSON.stringify({ ...params, old_string: "[omitted]", new_string: "[omitted]" })}`);
      return await api.patchPage(
        params.id,
        params.old_string,
        params.new_string,
        params.replace_all === true
      );
    },
    replace_section: async (params: any) => {
      console.log(`[Implementations] replace_section called with params: ${JSON.stringify({ ...params, new_markdown: "[omitted]" })}`);
      return await api.replaceSection(params.id, params.heading, params.new_markdown);
    },
    append_to_page: async (params: any) => {
      console.log(`[Implementations] append_to_page called with params: ${JSON.stringify({ ...params, markdown: "[omitted]" })}`);
      return await api.appendToPage(params.id, params.markdown);
    },
    insert_after_heading: async (params: any) => {
      console.log(`[Implementations] insert_after_heading called with params: ${JSON.stringify({ ...params, markdown: "[omitted]" })}`);
      return await api.insertAfterHeading(params.id, params.heading, params.markdown);
    },
    delete_page: async (params: any) => {
      console.log(`[Implementations] delete_page called with params: ${JSON.stringify(params)}`);
      return await api.deletePage(params.id);
    },
    move_page: async (params: any) => {
      console.log(`[Implementations] move_page called with params: ${JSON.stringify(params)}`);
      return await api.movePage(params.id, params.destinationPath, params.destinationLocale);
    },
    list_users: async (params: any) => {
      console.log(`[Implementations] list_users called with params: ${JSON.stringify(params)}`);
      return await api.listUsers();
    },
    search_users: async (params: any) => {
      console.log(`[Implementations] search_users called with params: ${JSON.stringify(params)}`);
      return await api.searchUsers(params.query);
    },
    list_groups: async (params: any) => {
      console.log(`[Implementations] list_groups called with params: ${JSON.stringify(params)}`);
      return await api.listGroups();
    },
    create_user: async (params: any) => {
      console.log(`[Implementations] create_user called with params: ${JSON.stringify(params)}`);
      return await api.createUser(
        params.email, params.name,
        params.passwordRaw || "tempPassword123",
        params.providerKey, params.groups,
        params.mustChangePassword, params.sendWelcomeEmail
      );
    },
    update_user: async (params: any) => {
      console.log(`[Implementations] update_user called with params: ${JSON.stringify(params)}`);
      return await api.updateUser(params.id, params.name);
    },
    list_all_pages: async (params: any) => {
      console.log(`[Implementations] list_all_pages called with params: ${JSON.stringify(params)}`);
      return await api.listAllPages(params.limit, params.orderBy, params.includeUnpublished);
    },
    search_unpublished_pages: async (params: any) => {
      console.log(`[Implementations] search_unpublished_pages called with params: ${JSON.stringify(params)}`);
      return await api.searchUnpublishedPages(params.query, params.limit);
    },
    force_delete_page: async (params: any) => {
      console.log(`[Implementations] force_delete_page called with params: ${JSON.stringify(params)}`);
      return await api.forceDeletePage(params.id);
    },
    get_page_status: async (params: any) => {
      console.log(`[Implementations] get_page_status called with params: ${JSON.stringify(params)}`);
      return await api.getPageStatus(params.id);
    },
    publish_page: async (params: any) => {
      console.log(`[Implementations] publish_page called with params: ${JSON.stringify(params)}`);
      return await api.publishPage(params.id);
    },
  };
}

// Default implementations using the server-wide API (for REST endpoints)
const implementations = createToolImplementations(defaultApi);

export const wikiJsToolsWithImpl = [
  // Get page by ID
  {
    type: "function",
    function: {
      name: "get_page",
      description: "Get Wiki.js page information by its ID",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "Page ID in Wiki.js",
          },
        },
        required: ["id"],
      },
    },
    implementation: implementations.get_page,
  },
  // Get page content by ID
  {
    type: "function",
    function: {
      name: "get_page_content",
      description: "Get Wiki.js page content by its ID",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "Page ID in Wiki.js",
          },
        },
        required: ["id"],
      },
    },
    implementation: implementations.get_page_content,
  },
  // List pages
  {
    type: "function",
    function: {
      name: "list_pages",
      description: "Get a list of Wiki.js pages with optional sorting",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description:
              "Maximum number of pages to return (default 50)",
          },
          orderBy: {
            type: "string",
            description: "Sort field (TITLE, CREATED, UPDATED)",
          },
        },
        required: [],
      },
    },
    implementation: implementations.list_pages,
  },
  // Search pages
  {
    type: "function",
    function: {
      name: "search_pages",
      description: "Search pages by query in Wiki.js",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query",
          },
          limit: {
            type: "number",
            description:
              "Maximum number of results (default 10)",
          },
        },
        required: ["query"],
      },
    },
    implementation: implementations.search_pages,
  },
  // Create page
  {
    type: "function",
    function: {
      name: "create_page",
      description: "Create a new page in Wiki.js",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Page title",
          },
          content: {
            type: "string",
            description: "Page content (Markdown format)",
          },
          path: {
            type: "string",
            description: "Page path (e.g. 'folder/page')",
          },
          description: {
            type: "string",
            description: "Short page description",
          },
          tags: {
            type: "array",
            items: {
              type: "string",
            },
            description: "Page tags",
          },
          published: {
            type: "boolean",
            description:
              "Whether the page is published and visible to all users (default: true). Set to false to save as a draft visible only to editors.",
          },
        },
        required: ["title", "content", "path"],
      },
    },
    implementation: implementations.create_page,
  },
  // Update page
  {
    type: "function",
    function: {
      name: "update_page",
      description: "Update an existing page in Wiki.js",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "Page ID to update",
          },
          content: {
            type: "string",
            description: "New page content (Markdown format)",
          },
          title: {
            type: "string",
            description: "New page title (optional, only updated if provided)",
          },
          description: {
            type: "string",
            description:
              "New page description (optional, only updated if provided)",
          },
        },
        required: ["id", "content"],
      },
    },
    implementation: implementations.update_page,
  },
  // Patch page (content-anchored find/replace)
  {
    type: "function",
    function: {
      name: "patch_page",
      description:
        "Edit part of a page without re-sending the whole page. Fetches the current content server-side, replaces old_string with new_string, and saves the merged result. old_string is matched by EXACT content (never by line number) and may span multiple lines. Like the Edit tool: old_string must be unique unless replace_all is true, and an exact substring of the current content (whitespace and line breaks included). Use this instead of update_page for small edits.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "Page ID to edit",
          },
          old_string: {
            type: "string",
            description:
              "Exact text to find in the current page content (may be multi-line). Must match byte-for-byte and be unique unless replace_all is set.",
          },
          new_string: {
            type: "string",
            description: "Text to replace old_string with.",
          },
          replace_all: {
            type: "boolean",
            description:
              "Replace every occurrence of old_string instead of requiring it to be unique (default false).",
          },
        },
        required: ["id", "old_string", "new_string"],
      },
    },
    implementation: implementations.patch_page,
  },
  // Replace section (by Markdown heading)
  {
    type: "function",
    function: {
      name: "replace_section",
      description:
        "Replace everything under a Markdown heading, up to the next heading of the same or higher level. The heading line itself is kept; only its body is replaced. Useful for larger structural rewrites without re-sending the whole page.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "Page ID to edit",
          },
          heading: {
            type: "string",
            description:
              "The heading whose section to replace, with or without leading '#'s (e.g. '## Session model' or 'Session model').",
          },
          new_markdown: {
            type: "string",
            description:
              "New markdown body to place under the heading (replaces the existing section body).",
          },
        },
        required: ["id", "heading", "new_markdown"],
      },
    },
    implementation: implementations.replace_section,
  },
  // Append markdown to the end of a page
  {
    type: "function",
    function: {
      name: "append_to_page",
      description:
        "Append a block of markdown to the end of a page, separated from existing content by a blank line. Does not re-send the whole page.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "Page ID to edit",
          },
          markdown: {
            type: "string",
            description: "Markdown to append to the end of the page.",
          },
        },
        required: ["id", "markdown"],
      },
    },
    implementation: implementations.append_to_page,
  },
  // Insert markdown immediately after a heading
  {
    type: "function",
    function: {
      name: "insert_after_heading",
      description:
        "Insert a block of markdown immediately after a given heading line, before that section's existing body. Does not re-send the whole page.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "Page ID to edit",
          },
          heading: {
            type: "string",
            description:
              "The heading to insert after, with or without leading '#'s (e.g. '## Session model' or 'Session model').",
          },
          markdown: {
            type: "string",
            description: "Markdown to insert after the heading.",
          },
        },
        required: ["id", "heading", "markdown"],
      },
    },
    implementation: implementations.insert_after_heading,
  },
  // Delete page
  {
    type: "function",
    function: {
      name: "delete_page",
      description: "Delete a page from Wiki.js",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "Page ID to delete",
          },
        },
        required: ["id"],
      },
    },
    implementation: implementations.delete_page,
  },
  // Move page to a new path
  {
    type: "function",
    function: {
      name: "move_page",
      description:
        "Move (relocate) a Wiki.js page to a new path/folder. Use this instead of update_page when you need to change the page's location in the wiki tree.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "Page ID to move",
          },
          destinationPath: {
            type: "string",
            description:
              "New path for the page (e.g. 'folder/subfolder/page-slug'). Must not include a leading slash.",
          },
          destinationLocale: {
            type: "string",
            description:
              "Locale for the destination path (e.g. 'en', 'ru'). Defaults to the current page locale if omitted.",
          },
        },
        required: ["id", "destinationPath"],
      },
    },
    implementation: implementations.move_page,
  },
  // List users
  {
    type: "function",
    function: {
      name: "list_users",
      description: "Get a list of Wiki.js users",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    implementation: implementations.list_users,
  },
  // Search users
  {
    type: "function",
    function: {
      name: "search_users",
      description: "Search users by query in Wiki.js",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query (name or email)",
          },
        },
        required: ["query"],
      },
    },
    implementation: implementations.search_users,
  },
  // List groups
  {
    type: "function",
    function: {
      name: "list_groups",
      description: "Get a list of Wiki.js user groups",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    implementation: implementations.list_groups,
  },
  // Create user
  {
    type: "function",
    function: {
      name: "create_user",
      description: "Create a new user in Wiki.js",
      parameters: {
        type: "object",
        properties: {
          email: {
            type: "string",
            description: "User email",
          },
          name: {
            type: "string",
            description: "User name",
          },
          passwordRaw: {
            type: "string",
            description: "User password (plain text)",
          },
          providerKey: {
            type: "string",
            description:
              "Authentication provider key (default 'local')",
          },
          groups: {
            type: "array",
            items: {
              type: "number",
            },
            description:
              "Array of group IDs to add the user to (default [2])",
          },
          mustChangePassword: {
            type: "boolean",
            description:
              "Require password change on next login (default false)",
          },
          sendWelcomeEmail: {
            type: "boolean",
            description: "Send welcome email (default false)",
          },
        },
        required: ["email", "name", "passwordRaw"],
      },
    },
    implementation: implementations.create_user,
  },
  // Update user
  {
    type: "function",
    function: {
      name: "update_user",
      description: "Update Wiki.js user information",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "User ID to update",
          },
          name: {
            type: "string",
            description: "New user name",
          },
        },
        required: ["id", "name"],
      },
    },
    implementation: implementations.update_user,
  },
  // List all pages including unpublished
  {
    type: "function",
    function: {
      name: "list_all_pages",
      description:
        "Get a list of all Wiki.js pages including unpublished with optional sorting",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description:
              "Maximum number of pages to return (default 50)",
          },
          orderBy: {
            type: "string",
            description: "Sort field (TITLE, CREATED, UPDATED)",
          },
          includeUnpublished: {
            type: "boolean",
            description:
              "Include unpublished pages (default true)",
          },
        },
        required: [],
      },
    },
    implementation: implementations.list_all_pages,
  },
  // Search unpublished pages
  {
    type: "function",
    function: {
      name: "search_unpublished_pages",
      description: "Search unpublished pages by query in Wiki.js",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query",
          },
          limit: {
            type: "number",
            description:
              "Maximum number of results (default 10)",
          },
        },
        required: ["query"],
      },
    },
    implementation: implementations.search_unpublished_pages,
  },
  // Force delete page (including unpublished)
  {
    type: "function",
    function: {
      name: "force_delete_page",
      description:
        "Force delete a page from Wiki.js (including unpublished pages)",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "Page ID to delete",
          },
        },
        required: ["id"],
      },
    },
    implementation: implementations.force_delete_page,
  },
  // Get page publication status
  {
    type: "function",
    function: {
      name: "get_page_status",
      description:
        "Get publication status and detailed page information",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "Page ID in Wiki.js",
          },
        },
        required: ["id"],
      },
    },
    implementation: implementations.get_page_status,
  },
  // Publish page
  {
    type: "function",
    function: {
      name: "publish_page",
      description: "Publish an unpublished page in Wiki.js",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "Page ID to publish",
          },
        },
        required: ["id"],
      },
    },
    implementation: implementations.publish_page,
  },
];

export {
  WikiJsToolDefinition,
  WikiJsPage,
  WikiJsUser,
  WikiJsGroup,
  ResponseResult,
  WikiJsAPI,
};
