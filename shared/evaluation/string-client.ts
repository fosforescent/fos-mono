import { IFosInterpreter} from "../dag-types";
import { FosClient } from "./client";

type StringViewOptions = {
  level?: number
}

type StringView = ({interpreter}: {interpreter: IFosInterpreter}) => string;
type StringViewGenerator = (opts?: StringViewOptions) => StringView

/**
 * TODO: remove this and replace with single, simplified function
 */

export default class StringClient extends FosClient<StringViewOptions, string> {

  getView(opts: StringViewOptions = {level: 0}): string {
    // console.log('get String Client view', this.interpreter.getStubString(), this.interpreter.getChildren().map((child: IFosInterpreter) => child.getStubString()))
    return this.reduceTree<StringViewOptions, string>(this.distributor, this.accumulator)(opts)
  }
  

  distributor(originalDistribution: StringViewOptions): ({ interpreter }: { interpreter: IFosInterpreter; }) => [StringViewOptions, StringViewOptions] {
    const returnVal:  [StringViewOptions, StringViewOptions] = [{...originalDistribution, level: originalDistribution.level ? originalDistribution.level + 1 : 1}, originalDistribution]
    // console.log('in distributor', originalDistribution, returnVal)
    return () => returnVal
  }

  accumulator(distribution: StringViewOptions): (props: { interpreter: IFosInterpreter; children: [StringViewOptions, IFosInterpreter][]; }) => string {
    const viewGenerator: (props: { interpreter: IFosInterpreter; children: [StringViewOptions, IFosInterpreter][]; }) => string = (props: { interpreter: IFosInterpreter; children: [StringViewOptions, IFosInterpreter][]; }) => {
      const indent = distribution?.level ? '    '.repeat(distribution.level) : ''
      // console.log('view accumulator',distribution)
      const renderedChildren = props.children.map(([childDistribution, childInterpreter]) => (new StringClient(childInterpreter.store, childInterpreter.getTarget(), childInterpreter.getInstruction())).getView(childDistribution))
      return `${indent}${props.interpreter.getDisplayString()}\n${indent}---${indent}${renderedChildren.join(`\n${indent}`)}\n${indent}---\n`  
    }
    return viewGenerator
  }

  reduceTree<U, V>(distributor: (originalDistribution: U) =>  ({interpreter}: {interpreter: IFosInterpreter}) => [U, U], 
    integrator: (distribution: U) => ({interpreter, children}: {interpreter: IFosInterpreter, children: [U, IFosInterpreter][]}) => V): (distribution: U) => V {
    const reductionGenerator = (currentNodeDistribution: U): V => {
      // console.log('reduceTree reductionGenerator', this.instruction.getAddress(), this.target.getAddress())
      const edges = this.interpreter.getChildren();
      const [childResults, selfDistribution]: [[U, IFosInterpreter][], U] = edges.reduce(([accumulatedChildResults, accumultatedDistribution]: [[U, IFosInterpreter][], U], child: IFosInterpreter) => {
        const [childDistribution, remainingDistribution] = distributor(accumultatedDistribution)({interpreter: child})
        // console.log('childDistribution', childDistribution, remainingDistribution)
        // const result = newInterpreter.reduceTree(distributor, integrator)(childDistribution)
        return [ [...accumulatedChildResults, [childDistribution, child]], remainingDistribution] as [[U, IFosInterpreter][], U]
      }, [[], currentNodeDistribution]);
      const integratedResult = integrator(selfDistribution)({interpreter: this.interpreter, children: childResults})
      return integratedResult
    }
    return reductionGenerator
  }


}