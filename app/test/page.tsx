'use client';

import React from 'react';
import { AgentAudioVisualizerAura } from '@/components/agents-ui/agent-audio-visualizer-aura';

export default function TestPage() {
  // --- 你在这里手动修改下面三个参数 ---
  const myColor = '#00f2fe';      // 基础颜色
  const myShift = 1.0;            // 颜色偏移量
  const myState = 'speaking';     // 状态: 'speaking', 'thinking', 'idle'
  // ------------------------------

  return (
    <div style={{ 
      backgroundColor: 'black', 
      width: '100vw', 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center' 
    }}>
      <h1 style={{ color: 'white', marginBottom: '20px' }}>Aura 实时调色预览</h1>
      
      <AgentAudioVisualizerAura
        size="xl"
        state={myState as any}
        color={myColor as any}
        colorShift={myShift}
        themeMode="dark"
      />

      <div style={{ color: '#666', marginTop: '20px' }}>
        当前参数：颜色 {myColor} | 偏移 {myShift}
      </div>
    </div>
  );
}