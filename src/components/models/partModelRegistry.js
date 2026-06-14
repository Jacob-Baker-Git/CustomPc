import MotherboardModel from './MotherboardModel'
import CpuModel from './CpuModel'
import CoolerModel from './CoolerModel'
import RamModel from './RamModel'

export const MODEL_REGISTRY = {
  motherboard: MotherboardModel,
  cpu: CpuModel,
  cooler: CoolerModel,
  ram: RamModel,
}
