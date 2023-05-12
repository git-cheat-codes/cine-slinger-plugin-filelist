import {load as loadHTML} from "cheerio"
import {CookieJar} from "tough-cookie";
import {parse, stringify} from "querystring";
import got, {Got, Response} from "got";
import {Logger} from "nas-movie-manager-provider-types";
import {FileCookieStore} from "tough-cookie-file-store";

function cfDecodeEmail(encodedString: string): string {
	let email = "";
	let r = parseInt(encodedString.substring(0, 2), 16), n, i;
	for (n = 2; encodedString.length - n; n += 2) {
		i = parseInt(encodedString.substring(n, 2), 16) ^ r;
		email += String.fromCharCode(i);
	}
	return email;
}

export interface FilelistSearchOptions {
	cat: number,
	searchin: number,
	sort: number,
	page: number
}

export interface FilelistTorrentInfo {
	id: string,
	cat: string,
	title: string,
	freeleech: boolean,
	url: string,
	torrentFile: string,
	image: string,
	date: string,
	size: string,
	seeds: number,
	leechers: number,
	path: string
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
	private readonly user: string;
	private readonly pass: string;
	private readonly baseUrl: string;
	private readonly log: Logger;
	private readonly cookieJar: CookieJar;
	private loginPromise?: Promise<void> | null;

	private client: Got;

	constructor(opt: FileListConstr) {
		this.user = opt.username;
		this.pass = opt.password;
		this.baseUrl = opt.baseUrl ?? "https://filelist.io";
		this.log = opt.log;
		this.cookieJar = new CookieJar(new FileCookieStore(opt.cookieFile));

		this.loginPromise = null;

		this.client = got.extend({
			cookieJar: this.cookieJar,
			prefixUrl: this.baseUrl + "/",
			headers: {
				"Connection": "keep-alive",
				"Cache-Control": "max-age=0",
				"Origin": this.baseUrl,
				"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.97 Safari/537.36",
				"Accept-Encoding": "gzip, deflate",
				"Accept-Language": "en-US,en;q=0.8,ro;q=0.6"
			},
		});
	}

	public async clearCookies() {
		this.log.debug("Clearing cookies")
		await this.cookieJar.removeAllCookies();
	}

	public search(query: string, opt?: FilelistSearchOptions): Promise<FilelistSearchResult> {
		const options = Object.assign({
			search: query,
			cat: 0,
			searchin: 0,
			sort: 0,
			page: 0
		}, opt);


		return new Promise<FilelistSearchResult>(async (resolve, reject) => {
			this.client.get("browse.php", {
				headers: {
					"Referer": this.baseUrl + "/browse.php"
				},
				searchParams: <any> options
			}
			).then(res => {
				if (res.redirectUrls.some(url => url.pathname.includes('/login'))) {
					this.log.debug("Not logged in");
					return this.login().then(() => {
						this.search(query, options).then(resolve).catch(reject);
					}).catch(reject);
				}

				const $ = loadHTML(res.body);
				let torrents: FilelistTorrentInfo[] = [];
				$(".torrentrow").each((key, item) => {
					let cat = $(".torrenttable:nth-child(1) img", item).attr("alt");
					let title = $(".torrenttable:nth-child(2) a", item).attr("title")!.trim();
					let date = $(".torrenttable:nth-child(6) .small", item).html()!.split("<br>")[1];
					let size = $(".torrenttable:nth-child(7)", item).text();
					let seed = $(".torrenttable:nth-child(9)", item).text();
					let peer = $(".torrenttable:nth-child(10)", item).text();
					let path = $(".torrenttable:nth-child(2) a", item).attr("href");
					let img = $(".torrenttable:nth-child(2) span[data-toggle='tooltip']", item).attr("title");
					let freeleech = $(".torrenttable:nth-child(2) [alt='FreeLeech']", item).length > 0

					if (img && img.match(/^<img/)) {
						img = $(img).attr("src");
					} else {
						img = "";
					}
					let id = parse(path?.split("?")[1]!)?.id;

					let emailProtection = $(".__cf_email__", item).attr('data-cfemail');
					if (emailProtection) {
						title = cfDecodeEmail(emailProtection);
					}

					torrents.push({
						id: id as string,
						cat: cat as string,
						title: title,
						freeleech: freeleech,
						url: this.baseUrl + "/" + path,
						torrentFile: this.baseUrl + "/download.php?id=" + id,
						image: img as string,
						date: date,
						size: size,
						seeds: parseInt(seed),
						leechers: parseInt(peer),
						path: path as string
					});
				});

				let totalPages = 0;
				$(".pager a").each((key, item) => {
					let page = parseInt($(item).text());
					if (page > totalPages)
						totalPages = page;
				});
				resolve(<FilelistSearchResult>{
					torrents: torrents,
					category: options.cat,
					page: options.page,
					totalPages: totalPages
				});
			}).catch(reject);
		});
	}

	login(): Promise<void> {
		if (this.loginPromise) {
			return this.loginPromise;
		}
		this.loginPromise = this.handleLoginResponse();
		this.loginPromise.finally(() => {
			this.loginPromise = null;
		});
		return this.loginPromise;
	}

	async handleLoginResponse() {
		const res = await this.client.get("my.php");
		if(!redirectedToLogin(res)) return; //was logged in already

		const $ = loadHTML(res.body);
		const loginRes = await this.client.post("takelogin.php", {
			body: stringify({
				validator: $("[name=validator]").val(),
				username: this.user,
				password: this.pass,
				returnto: "/"
			}),
			headers: {
				"Referer": this.baseUrl + "/login.php",
				'Content-Type': 'application/x-www-form-urlencoded'
			}
		});
		if(loginRes.body.trim() !== "" && !loginRes.url.includes("/takelogin/")){
			this.log.debug("Logged in successfully");
		}else{
			throw loginRes;
		}
	}

	async download(torrentUrl: string): Promise<Buffer> {
		const res = await this.client.get(torrentUrl);
		if (redirectedToLogin(res)) {
			await this.login();
			return await this.download(torrentUrl);
		}
		return res.rawBody;
	}
};

function redirectedToLogin(res: Response): boolean {
	return res.redirectUrls.some(url => url.pathname.includes('/login'))
}