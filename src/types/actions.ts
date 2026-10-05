export type ActionType =
  | 'create_panel'
  | 'edit_panel'
  | 'delete_panel'
  | 'move_component'
  | 'resize_component'
  | 'change_style'
  | 'add_indicator'
  | 'remove_indicator'
  | 'configure_indicator'
  | 'add_chart_level'
  | 'add_support_resistance'
  | 'add_drawing'
  | 'change_symbol'
  | 'change_timeframe'
  | 'create_alert'
  | 'generate_pine_script'
  | 'edit_strategy'
  | 'open_workspace'
  | 'restore_version';

export interface Action {
  id: string;
  type: ActionType;
  payload: Record<string, any>;
  timestamp: number;
  status: 'PENDING' | 'APPLIED' | 'CANCELLED';
  userId: string;
}

export interface ActionPlan {
  id: string;
  intent: string;
  target: string;
  actions: any[];
  summary: string;
}
