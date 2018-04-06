import { Log, OdnUtils } from "../../../odnUtils";
import { AccountConfigs, AccountData } from "../../../configs/accountConfigs";
import { OdnPlugins } from "../../../odnPlugins";
import { OdnTweets } from "../../../odnTweets";

export class TweetScheduler {
  constructor(private accountData: AccountData, private nowDate: Date, private fullName: string) {}

  /**
   * プラグインのメイン処理を実行
   *
   * @param {(isProcessed?: boolean) => void} finish
   */
  run(finish: (isProcessed?: boolean) => void) {
    const storedData = TweetScheduler.getStoredSchedule(this.fullName, this.accountData.userId);
    const dateKey = TweetScheduler.getScheduleKey(this.nowDate);
    if (storedData && storedData[dateKey]) {
      for (const reservedNumber of Object.keys(storedData[dateKey])) {
        const tweets = new OdnTweets(this.accountData);
        tweets.text = storedData[dateKey][reservedNumber];
        tweets.postTweet((isSuccess, error, tweetData, response) => {
          if (isSuccess) {
            TweetScheduler.deleteSchedule(this.accountData.userId, this.nowDate, parseInt(reservedNumber));
          } else {
            Log.e("error: ", error);
          }
        });
      }
    }

    finish();
  }

  /**
   * プラグインを実行するかどうか判定
   *
   * @param accountData
   * @param nowDate
   * @returns {boolean}
   */
  static isValid(accountData: AccountData, nowDate: Date): boolean {
    // 毎分実行のため常にtrue
    return true;
  }

  /**
   * 保存済みのスケジュールを取得
   *
   * @param userId
   * @returns {any|{}}
   */
  static getStoredSchedule(pluginFullName: string, userId: string): {string: {number: ScheduleData}} {
    return OdnPlugins.getStoredData(pluginFullName, userId) || {};
  }

  /**
   * スケジュールを保存
   *
   * @param userId
   * @param data
   */
  static saveSchedule(pluginFullName: string, userId: string, data: {string: {number: ScheduleData}}) {
    OdnPlugins.setStoredData(pluginFullName, userId, data);
  }

  /**
   * ツイート投稿を予約
   *
   * @param userId
   * @param date
   * @param message
   * @returns {number}
   */
  static setSchedule(userId: string, date: Date, message: string): number {
    const pluginFullName = TweetSchedulerConstats.PLUGIN_FULL_NAME;
    const storedData = TweetScheduler.getStoredSchedule(pluginFullName, userId);
    const dateKey = TweetScheduler.getScheduleKey(date);
    const reservedKey = (() => {
      const reservedKeyList = storedData && storedData[dateKey] ? Object.keys(storedData[dateKey]) : null;
      return reservedKeyList && 0 < reservedKeyList.length ? Math.max.apply(null, reservedKeyList) + 1 : 1;
    })();
    if (1 === reservedKey) {
      storedData[dateKey] = {};
    }
    storedData[dateKey][reservedKey] = message;
    TweetScheduler.saveSchedule(pluginFullName, userId, storedData);
    return reservedKey;
  }

  /**
   * 予約済みの投稿を削除
   *
   * @param userId
   * @param date
   * @param reservedKey
   * @returns {boolean}
   */
  static deleteSchedule(userId: string, date: Date, reservedKey?: number): boolean {
    let hasMessage = false;
    const pluginFullName = TweetSchedulerConstats.PLUGIN_FULL_NAME;
    const storedData = TweetScheduler.getStoredSchedule(pluginFullName, userId);
    const dateKey = TweetScheduler.getScheduleKey(date);
    if (storedData && storedData[dateKey]) {
      if (reservedKey) {
        if (storedData[dateKey][reservedKey]) {
          delete storedData[dateKey][reservedKey];
          if (0 === Object.keys(storedData[dateKey]).length) {
            delete storedData[dateKey];
          }
          hasMessage = true;
        } else {
          hasMessage = false;
        }
      } else {
        delete storedData[dateKey];
        hasMessage = true;
      }
    }

    if (hasMessage) {
      TweetScheduler.saveSchedule(pluginFullName, userId, storedData);
    }
    return hasMessage;
  }

  /**
   * スケジュール保存用のIDを取得
   *
   * @param date
   * @returns {string}
   */
  static getScheduleKey(date: Date): string {
    return OdnUtils.convDateToString(date, "yyyymmdd-HHMM");
  }
}

class ScheduleData {
  date: Date;
  message: string;

  constructor(item?: any) {
    if (item) {
      for (const key of Object.keys(item)) {
        this[key] = item[key];
      }
    }
  }
}

namespace TweetSchedulerConstats {
  export const PLUGIN_FULL_NAME = "PluginsBatchTweetScheduler";
}