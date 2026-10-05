import { Action, ActionType } from '../types/actions';
import { v4 as uuidv4 } from 'uuid';

export class ActionEngine {
  private panelCallback: ((action: Action) => void) | null = null;

  registerPanelCallback(callback: (action: Action) => void) {
    this.panelCallback = callback;
  }

  async processIntent(intent: string): Promise<Action> {
    // In a real implementation, this would call the API /api/platform/intent
    let type: ActionType = 'create_panel';
    let payload: Record<string, any> = { description: intent };

    if (intent.includes('RSI') || intent.includes('ATR')) {
      type = 'create_panel';
      payload = {
        type: 'indicator_panel',
        position: 'right',
        size: 'small',
        components: [
          { type: 'RSI', period: 14 },
          { type: 'ATR', period: 14 },
          { type: 'TREND_STRENGTH' }
        ]
      };
    }

    return {
      id: uuidv4(),
      type,
      payload,
      timestamp: Date.now(),
      status: 'PENDING',
      userId: 'user123'
    };
  }

  async applyAction(action: Action) {
    console.log('Applying action:', action);
    if (action.type === 'create_panel' && this.panelCallback) {
      this.panelCallback(action);
    }
  }
}

export const actionEngine = new ActionEngine();
