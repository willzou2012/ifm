import './styles/ifm.css'
import { IFM } from './IFM'

declare global {
  interface Window {
    IFM: typeof IFM
  }
}

window.IFM = IFM
