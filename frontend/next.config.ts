import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["react-markdown", "remark-gfm", "unified", "bail", "is-plain-obj", "trough", "vfile", "unist-util-stringify-position", "micromark", "decode-named-character-reference", "character-entities", "mdast-util-from-markdown", "mdast-util-to-markdown", "mdast-util-gfm", "micromark-extension-gfm", "remark-parse", "remark-stringify"],
  images: {
    remotePatterns: [
      { hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
