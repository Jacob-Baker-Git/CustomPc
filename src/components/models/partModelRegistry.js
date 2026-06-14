import MotherboardModel from './MotherboardModel'
import CpuModel from './CpuModel'
import CoolerModel from './CoolerModel'
import RamModel from './RamModel'
import GpuModel from './GpuModel'
import StorageModel from './StorageModel'
import PsuModel from './PsuModel'
import CaseModel from './CaseModel'
import FansModel from './FansModel'

export const MODEL_REGISTRY = {
  motherboard: MotherboardModel,
  cpu: CpuModel,
  cooler: CoolerModel,
  ram: RamModel,
  gpu: GpuModel,
  storage: StorageModel,
  psu: PsuModel,
  case: CaseModel,
  fans: FansModel,
}
