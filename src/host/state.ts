let activeConnectionId: string | null = null

export const getActiveConnectionId = () => activeConnectionId
export const setActiveConnectionId = (id: string) => { activeConnectionId = id }
