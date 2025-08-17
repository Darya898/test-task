class Channel {
    constructor(id, checkFunc) {
        this.id = id;
        this.checkFunc = checkFunc;
        this.state = 'idle';
    }

    async checkAvailability() {
        try {
            const available = await this.checkFunc();
            const oldState = this.state;
            if (available) {
                this.state = 'idle';
            } else {
                this.state = 'unavailable';
            }
            return { oldState, newState: this.state };
        } catch (err) {
            console.error(`Error checking channel ${this.id}:`, err);
            const oldState = this.state;
            this.state = 'unavailable';
            return { oldState, newState: this.state };
        }
    }
}

class ConnectionManager {
    constructor(channels, checkIntervalMs = 5000) {
        this.channels = channels;
        this.currentChannel = null;
        this.checkIntervalMs = checkIntervalMs;
        this.eventListeners = [];
        this.dataBuffer = [];
        this.monitorIntervalId = null;
    }

    addEventListener(listener) {
        this.eventListeners.push(listener);
    }

    async notify(event) {
        for (const listener of this.eventListeners) {
            await listener(event);
        }
    }

    startMonitoring() {
        if (this.monitorIntervalId) return;
        this.monitorIntervalId = setInterval(async () => {
            await Promise.all(this.channels.map(ch => ch.checkAvailability()));
            await this.evaluateChannels();
        }, this.checkIntervalMs);
    }

    stopMonitoring() {
        clearInterval(this.monitorIntervalId);
        this.monitorIntervalId = null;
        console.log("остановили мониторинг")
    }

    async evaluateChannels() {
        if (
            !this.currentChannel ||
            (this.currentChannel && this.currentChannel.state !== 'connected')
        ) {
            const nextChannel = this.selectNextChannel();
            if (nextChannel && nextChannel !== this.currentChannel) {
                await this.switchToChannel(nextChannel);
                await this.notify({
                    channelId: nextChannel.id,
                    oldState: 'unknown',
                    newState: 'connected',
                });
            } else if (!nextChannel) {
                console.warn('Нет доступных каналов');
            }
        }
    }

    selectNextChannel() {
        for (const ch of this.channels) {
            if (ch.state === 'idle' || ch.state === 'connected') {
                return ch;
            }
        }
        return null;
    }

    async switchToChannel(channel) {
        console.log(`Переключение на канал ${channel.id}`);
        channel.state = 'connected';
        this.currentChannel = channel;
    }

    async getData() {
        if (!this.currentChannel || this.currentChannel.state !== 'connected') {
            console.error('Нет активного канала для получения данных');
            return null;
        }

        try {
            const data = await fetchDataFromChannel(this.currentChannel);
            this.dataBuffer.push(data);
            return data;
        } catch (err) {
            console.error(`Ошибка получения данных с канала ${this.currentChannel.id}:`, err);
            await this.evaluateChannels();
            return null;
        }
    }
}

async function fetchDataFromChannel(channel) {
    await new Promise((res) => setTimeout(res, 100));
    return { channelId: channel.id, data: "sample data" };
}