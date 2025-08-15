import { getDBStatus } from '../database/db.js';

export const checkHealth = async (req, res) => {
    const status = getDBStatus()

    const readyState = getReadyStateText(status.readyState)
    if (!status.isConnected) {
        return res.json({
            message: "error connecting db",
            status: 503,
            readyState,
            success: false
        })
    }
    
    return res.json({
        message: "db connected",
        status: 200,
        readyState,
        success: true
    })
};

function getReadyStateText(state) {
    switch (state) {
        case 0: return 'disconnected';
        case 1: return 'connected';
        case 2: return 'connecting';
        case 3: return 'disconnecting';

        default: return 'unknown'
    }
}
