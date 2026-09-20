import { useState, useEffect, useCallback } from 'react';
import { ModelInfo, ModelStatusType } from '../types';
import { localModelService } from '../services/LocalModelService';

export function useLocalModel() {
  const [modelInfo, setModelInfo] = useState<ModelInfo>(() => localModelService.getModelStatus());
  const [isCapabilityChecked, setIsCapabilityChecked] = useState(false);

  useEffect(() => {
    async function init() {
      await localModelService.detectCapabilities();
      setModelInfo(localModelService.getModelStatus());
      setIsCapabilityChecked(true);
    }
    init();
  }, []);

  const loadModel = useCallback(async () => {
    try {
      setModelInfo((prev) => ({ ...prev, status: 'loading' }));
      await localModelService.loadModel();
      setModelInfo(localModelService.getModelStatus());
    } catch (err: any) {
      setModelInfo((prev) => ({ ...prev, status: 'error' }));
    }
  }, []);

  const unloadModel = useCallback(async () => {
    await localModelService.unloadModel();
    setModelInfo(localModelService.getModelStatus());
  }, []);

  const reloadModel = useCallback(async () => {
    await unloadModel();
    await loadModel();
  }, [loadModel, unloadModel]);

  return {
    modelInfo,
    isCapabilityChecked,
    loadModel,
    unloadModel,
    reloadModel,
  };
}
