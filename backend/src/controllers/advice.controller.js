const ruleEngine = require('../services/rule-engine.service');

const adviceController = {
    // GET /api/advice
    getAdvice: async (req, res) => {
        try {
            const advice = await ruleEngine.generateAdvice();
            res.json({
                timestamp: new Date(),
                advice: advice.advice || [],
                suggestions: advice.suggestions || []
            });
        } catch (error) {
            console.error('Error generating advice:', error);
            res.status(500).json({ error: 'Failed to generate advice' });
        }
    }
};

module.exports = adviceController;