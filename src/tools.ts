import {
  WikiJsToolDefinition,
  WikiJsPage,
  WikiJsUser,
  WikiJsGroup,
  ResponseResult,
} from "./types.js";
import { GraphQLClient, gql } from "graphql-request";

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
        },
        required: ["id", "content"],
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

// Wiki.js API base class
class WikiJsAPI {
  private client: GraphQLClient;
  private token: string;
  private baseUrl: string;
  private locale: string;

  constructor(
    baseUrl: string = "http://localhost:3000",
    token: string = "",
    locale: string = "en"
  ) {
    console.log(
      `[WikiJsAPI] Constructor called. baseUrl: ${baseUrl}, token: ${
        token ? "provided" : "missing"
      }, locale: ${locale}`
    );
    this.client = new GraphQLClient(`${baseUrl}/graphql`);
    this.token = token;
    this.baseUrl = baseUrl;
    this.locale = locale;

    if (token) {
      console.log("[WikiJsAPI] Setting Authorization header.");
      this.client.setHeader("Authorization", `Bearer ${token}`);
    }
  }

  // Generate page URL
  private generatePageUrl(path: string): string {
    return generatePageUrl(this.baseUrl, this.locale, path);
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
    tags: string[] = ["mcp", "test"]
  ): Promise<WikiJsPage> {
    console.log(
      `[WikiJsAPI] createPage called with title: ${title}, path: ${path}, description: ${description}, tags: ${tags.join(
        ", "
      )}`
    );
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
      isPublished: true,
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
  async updatePage(id: number, content: string, title?: string): Promise<WikiJsPage> {
    console.log(`[WikiJsAPI] updatePage called with id: ${id}, title: ${title ?? "(unchanged)"}`);

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
      description: meta.description ?? "",
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
        return await this.getPage(id);
      }

      const page = data.pages.update.page;
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
        params.description, params.tags || ["mcp", "test"]
      );
    },
    update_page: async (params: any) => {
      console.log(`[Implementations] update_page called with params: ${JSON.stringify(params)}`);
      return await api.updatePage(params.id, params.content, params.title);
    },
    delete_page: async (params: any) => {
      console.log(`[Implementations] delete_page called with params: ${JSON.stringify(params)}`);
      return await api.deletePage(params.id);
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
        },
        required: ["id", "content"],
      },
    },
    implementation: implementations.update_page,
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
