import { sha3_256 } from "js-sha3"
import { FosDataContent, FosNodeContent, FosPathElem } from "../types"
import { hashContent } from "./store"





describe('hash tests', () => {

    it('it has hte same hash no matter what', () => { 
      const nodeData: FosDataContent = {
      option: {
        selectedIndex: 0,
        defaultResolutionStrategy: 'choice',
      },
      description: {
        content: 'This is a description'
      },
      alias: {
        id: '1234'
      }

    }

    const content: FosNodeContent = {
      data: nodeData,
      children: [
        ['a', 'b'],
        ['b', 'c']
      ]
    }
    
    const hash1 = hashContent(content);
    
    // Create a new object with reordered keys
    const reorderedData = Object.keys(content.data)
      .reverse()
      .reduce((obj: any, key: string) => {
        obj[key] = content.data[key as keyof typeof content.data];
        return obj;
      }, {});
    
    const reorderedContent = {
      ...content,
      data: reorderedData
    };
    
    const hash2 = hashContent(reorderedContent);
    
    expect(hash1).toEqual(hash2);
    
  })

})