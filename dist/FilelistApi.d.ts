/// <reference types="node" />
import { Logger } from "nas-movie-manager-provider-types";
export interface FilelistSearchOptions {
    cat: number;
    searchin: number;
    sort: number;
    page: number;
}
export interface FilelistTorrentInfo {
    id: string;
    cat: string;
    title: string;
    freeleech: boolean;
    url: string;
    torrentFile: string;
    image: string;
    date: string;
    size: string;
    seeds: number;
    leechers: number;
    path: string;
}
export interface FilelistSearchResult {
    torrents: FilelistTorrentInfo[];
    category: number;
    page: number;
    totalPages: number;
}
export interface FileListConstr {
    username: string;
    password: string;
    baseUrl?: string;
    cookieFile: string;
    log: Logger;
}
export default class FileList {
    private readonly user;
    private readonly pass;
    private readonly baseUrl;
    private readonly log;
    private readonly cookieJar;
    private loginPromise?;
    private client;
    constructor(opt: FileListConstr);
    clearCookies(): Promise<void>;
    search(query: string, opt?: FilelistSearchOptions, retry?: number): Promise<FilelistSearchResult>;
    login(): Promise<void>;
    handleLoginResponse(): Promise<void>;
    download(torrentUrl: string, retry?: number): Promise<Buffer>;
}
//# sourceMappingURL=FilelistApi.d.ts.map