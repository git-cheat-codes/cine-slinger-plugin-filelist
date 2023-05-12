import type { Logger, MovieDetails, MovieTorrentInfo, ProviderConfig, ProviderInfo, Torrent, TorrentProvider } from "nas-movie-manager-provider-types";
import FileList from "./FilelistApi.js";
interface FilelistConfig extends ProviderConfig {
    username: string;
    password: string;
    base_url?: string;
}
declare class FilelistProvider implements TorrentProvider {
    api: FileList;
    log: Logger;
    getTorrentFor(movie: MovieTorrentInfo): Promise<Torrent>;
    init(config: FilelistConfig, log: Logger): Promise<void>;
    searchMovie(movie: MovieDetails): Promise<MovieTorrentInfo[]>;
    clearData(): Promise<void>;
}
export default FilelistProvider;
export declare const info: ProviderInfo;
//# sourceMappingURL=index.d.ts.map