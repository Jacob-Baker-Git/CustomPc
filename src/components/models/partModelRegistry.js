import MotherboardModel from './MotherboardModel'
import CpuModel from './CpuModel'
import CoolerModel from './CoolerModel'
import RamModel from './RamModel'
import GpuModel from './GpuModel'
import StorageModel from './StorageModel'

export const MODEL_REGISTRY = {
  motherboard: MotherboardModel,
  cpu: CpuModel,
  cooler: CoolerModel,
  ram: RamModel,
  gpu: GpuModel,
  storage: StorageModel,
}
