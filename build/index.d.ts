/**
 * 播放器传入的参数
 * @remark
 * url和file必须有一个  同时传url会覆盖掉file参数
 */
interface PlayerOpt {
    /**
     * 文件地址
     */
    url?: string;
    /**
     * 二进制文件（用于文件上传）
     */
    file?: File;
    /**
     * 播放器初始化的回调
     */
    afterInit: Function;
    /**
     *  文件类型 指定后不再通过url来判断
     */
    fileType?: string;
}
declare class AudioPlayer {
    private _file;
    private extName;
    private playUrl;
    private commonPlayer;
    private amrPlayer;
    private afterInit;
    private _onEnd;
    /**
     *  音频的总时间
     */
    duration: number;
    private timeUpdateFn;
    private startTime;
    private temporary;
    /**
     *
     * @typeParam PlayerOpt
     *
     */
    constructor(opt: PlayerOpt);
    /**
     * @private
     */
    createPlayer(): void;
    /**
     *
     * @remarks
     * 播放功能
     */
    play(): void;
    /**
     * @remarks
     * 是暂停，不是停止功能
     */
    pause(): void;
    /**
     *
     * @param time 选择从当前时间播放
     */
    setTime(time: number): void;
    /**
     * 销毁该播放器实例，解绑事件
     */
    destroy(): void;
    /**
     *
     * @param fn 可传参数为当前的时间
     * @example
     * play.onTimeUpdate(time=>console.log(time))
     *
     */
    onTimeUpdate(fn: Function): void;
    /**
     *
     * @param fn 音频播放完成的回调
     */
    onEnd(fn: Function): void;
    /**
     * @private
     */
    amrTimeUpdate(): void;
}

interface ConvertOpt {
    /**
       * 文件地址
       */
    url?: string;
    /**
       * 二进制文件（用于文件上传）
       */
    file?: File;
    /**
       * 播放器初始化的回调
       */
    /**
       *  文件类型 指定后不再通过url来判断
       */
    fileType?: string;
}
declare class ConvertPlayer {
    private _file;
    private extName;
    private playUrl;
    audio: HTMLAudioElement | null;
    constructor(opt: ConvertOpt);
    createPlayer(): void;
    mount(parent: HTMLElement): void;
}

export { AudioPlayer, ConvertOpt, ConvertPlayer, PlayerOpt };
