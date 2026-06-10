declare module 'react-simple-maps' {
  import { ComponentType, SVGProps } from 'react'

  export interface ComposableMapProps {
    projectionConfig?: Record<string, unknown>
    style?: React.CSSProperties
    children?: React.ReactNode
    [key: string]: unknown
  }

  export interface GeographiesProps {
    geography: string
    children: (props: { geographies: any[] }) => React.ReactNode
  }

  export interface GeographyProps extends SVGProps<SVGPathElement> {
    geography: any
    [key: string]: unknown
  }

  export const ComposableMap: ComponentType<ComposableMapProps>
  export const Geographies: ComponentType<GeographiesProps>
  export const Geography: ComponentType<GeographyProps>
}
