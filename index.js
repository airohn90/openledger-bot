(async () => {
    // 导入所需模块
    const fetch = (await import('node-fetch')).default;
    const chalk = (await import('chalk')).default;
    const fs = require('fs').promises;
    
    const CONFIG = {
      BASE_URL: "https://rewardstn.openledger.xyz/api/v1",
      SLEEP_INTERVAL: 12 * 60 * 60 * 1000,
      TOKEN_FILE: "token.txt",
    };


    let headers = {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json; charset=utf-8',
        'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    };


    async function readTokens() {
        try {
            const tokenData = await fs.readFile(CONFIG.TOKEN_FILE, 'utf-8');
            const tokens = tokenData.split('\n').filter(line => line.trim());

            return tokens;
        } catch (err) {
            console.error("读取 token 文件失败:", err.message);
            return [];
        }
    }

    async function coday(url, method, payloadData = null, headers = headers) {
        try {
            const options = {
                method,
                headers,
                body: payloadData ? JSON.stringify(payloadData) : null
            };
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('错误:', error);
            return null;
        }
    }

     async function rewardInfo(headers) {
        const reward = await coday(`${CONFIG.BASE_URL}/reward`, 'GET', null, headers);
        if (reward && reward.data){
            console.info(chalk.blue(`totalPoint: ${reward.data.totalPoint}`));
        } else {
            console.error(chalk.red(`获取总信息失败`));
        }
    }

    async function streakClaim(headers, {day, id, points}) {
        const reward = await coday(`${CONFIG.BASE_URL}/streak-claim/${id}`, 'GET', null, headers);
        if (reward && reward.data){
            console.info(chalk.blue(`领取 ${day} 天奖励 ${points} 成功`));
        } else {
            console.error(chalk.red(`领取 ${day} 天奖励失败`));
        }
    }

    async function streak(headers) {
        const streakDetail = await coday(`${CONFIG.BASE_URL}/streak`, 'GET', null, headers);
        if (streakDetail && streakDetail.data){
            for (const item of streakDetail.data) {
                const {day, isClaimed, id, milestoneClaim, points, showClaimButton} = item;
                if (isClaimed && !milestoneClaim && id) {
                    await streakClaim(headers, {day, id, points});
                }
            }
        }
    }

     async function claim(headers) {
        const reward = await coday(`${CONFIG.BASE_URL}/claim_reward`, 'GET', null, headers);
        if (reward && reward.data && reward.data.claimed){
            console.info(chalk.blue(`每日签到成功`));
            await rewardInfo(headers);
        } else {
            console.error(chalk.red(`每日签到失败`));
        }
    }

    async function claimDetails(headers) {
        const claimDetail = await coday(`${CONFIG.BASE_URL}/claim_details`, 'GET', null, headers);
        if (claimDetail && claimDetail.data){
            const {claimed,nextClaim} = claimDetail.data;
            console.log(chalk.blue(`claimed: ${claimed} | nextClaim: ${nextClaim}`));
            let date = new Date(nextClaim);
            let milliseconds = date.getTime();
            const timeOffset = new Date().getTime() - milliseconds;
            if(!claimed || timeOffset > 0) {
                await claim(headers);
                return 5*60000;
            }
            return -timeOffset;
        } else {
            console.error(chalk.red(`获取信息失败`));
        }
        return 5*60000;
    }

    async function processAccount(access_token, accountIndex) {
        headers = {
            ...headers,
            Authorization: `Bearer ${access_token}`,
        };

        const nextTime = await claimDetails(headers);
        await streak(headers);

        return nextTime;
    }

    async function main() {
        while (true) {
            const accounts = await readTokens();

            if (accounts.length === 0) {
                console.error("没有账户可处理。");
                return;
            }

            let nextTime = 5*60000;
            for (let i = 0; i < accounts.length; i++) {
                const account = accounts[i];
                console.info(`[${new Date().toString()}] 正在处理账户 ${i + 1}...`);
                nextTime = await processAccount(account, i);
            }
            console.info(`所有账户已处理，等待 ${Math.floor(nextTime/1000/3600)}h${Math.floor(nextTime/1000/60)%60}m${Math.floor(nextTime/1000)%60}s 后进行下一次获取...`);
            await new Promise(resolve => setTimeout(resolve, nextTime));
        }
    }

    await main();
})();
