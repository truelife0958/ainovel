declare module "next" {
  export type Metadata = Record<string, unknown>;
  export type Viewport = Record<string, unknown>;
  export type ResolvingMetadata = Metadata | Promise<Metadata>;
  export type ResolvingViewport = Viewport | Promise<Viewport>;
}

declare module "next/server" {
  export class NextResponse extends Response {
    static json(data: unknown, init?: ResponseInit): Response;
  }
}

declare module "next/server.js" {
  export interface NextRequest extends Request {}
}

declare module "next/link" {
  import type { AnchorHTMLAttributes, ReactNode } from "react";

  export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
    href: string;
    children?: ReactNode;
  }

  export default function Link(props: LinkProps): ReactNode;
}

declare module "next/types.js" {
  export type Metadata = Record<string, unknown>;
  export type Viewport = Record<string, unknown>;
  export type ResolvingMetadata = Metadata | Promise<Metadata>;
  export type ResolvingViewport = Viewport | Promise<Viewport>;
}
