import "next-auth";

declare module "next-auth" {
    interface Session {
        sessionToken?: string;
    }
}

declare module "*.mp4" {
    const src: string;
    export default src;
}