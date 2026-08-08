
export interface ApiResponse<T> {
    data: T;
    error?: string;
    status: number;
    message?: string;
}

export interface ClientToServerEvents {
    [event: string]: (data: unknown, callback?: (res: { success: boolean, message: string }) => void) => void
}

export type AppSocket = import("socket.io-client").Socket<ClientToServerEvents>;