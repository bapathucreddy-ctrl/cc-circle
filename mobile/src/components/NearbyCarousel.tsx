import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FlatList, Pressable, Text, View, type ViewToken } from 'react-native';
import type { Professional } from '../domain';
import { Icon, useTheme } from '../ui';

/** Stable ordering: selecting a pin scrolls to its card rather than reordering results. */
export function NearbyCarousel({ people, focusedId, onFocus, renderCard }: {
  people: Professional[]; focusedId?: string; onFocus: (id: string) => void;
  renderCard: (person: Professional) => ReactNode;
}) {
  const { colors } = useTheme();
  const list = useRef<FlatList<Professional>>(null);
  const [viewport, setViewport] = useState(340);
  const cardWidth = Math.min(420, Math.max(220, viewport - (people.length > 1 ? 44 : 32))), stride = cardWidth + 12;
  const target = useRef<string | null>(null);
  const latest = useRef({ people, focusedId, onFocus });latest.current = { people, focusedId, onFocus };
  const ids = people.map(person => person.id).join('|');
  const activeIndex = Math.max(0, people.findIndex(person => person.id === focusedId));
  useEffect(() => {
    if (!people.length) return;
    const index = people.findIndex(person => person.id === focusedId);
    if (index < 0) { onFocus(people[0]!.id); return; }
    target.current = focusedId || null;
    list.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
  }, [focusedId, ids, stride]);
  const viewability = useRef({ itemVisiblePercentThreshold: 70 });
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<Professional>[] }) => {
    const requested = target.current;
    if (requested) {
      if (viewableItems.some(item => item.item.id === requested)) target.current = null;
      return;
    }
    const first = viewableItems.find(item => item.isViewable)?.item;
    if (first && first.id !== latest.current.focusedId) latest.current.onFocus(first.id);
  });
  function select(index: number) { const person = people[index];if (person) onFocus(person.id); }
  return <View testID="nearby-professional-carousel" onLayout={event => { const width=event.nativeEvent.layout.width;if(width>0)setViewport(width); }}>
    <FlatList ref={list} horizontal data={people} keyExtractor={person => person.id}
      renderItem={({item}) => <View style={{ width: cardWidth }}>{renderCard(item)}</View>}
      ItemSeparatorComponent={() => <View style={{width:12}} />}
      contentContainerStyle={{ paddingLeft:16,paddingRight:Math.max(16,viewport-cardWidth-16),paddingVertical:2 }}
      showsHorizontalScrollIndicator={false} snapToInterval={stride} snapToAlignment="start" decelerationRate="fast" disableIntervalMomentum
      getItemLayout={(_,index)=>({length:stride,offset:stride*index,index})}
      viewabilityConfig={viewability.current} onViewableItemsChanged={onViewableItemsChanged.current}
      onScrollBeginDrag={()=>{target.current=null;}}
      onScrollToIndexFailed={({index})=>list.current?.scrollToOffset({offset:index*stride,animated:true})}
      keyboardShouldPersistTaps="handled" />
    {people.length>1 && <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingTop:4}}>
      <Text accessibilityLiveRegion="polite" style={{fontSize:11,color:colors.muted}}>Swipe to explore · {activeIndex+1} / {people.length}</Text>
      <View style={{flexDirection:'row',gap:4}}>{[-1,1].map(direction=>{
        const disabled = activeIndex + direction < 0 || activeIndex + direction >= people.length;
        return <Pressable key={direction} accessibilityRole="button" accessibilityLabel={direction<0?'Previous professional':'Next professional'} disabled={disabled} onPress={()=>select(activeIndex+direction)} style={({pressed})=>({width:44,height:44,alignItems:'center',justifyContent:'center',opacity:disabled ? .25 : pressed ? .6 : 1,transform:[{rotate:direction<0?'180deg':'0deg'}]})}><Icon name="arrow" size={17}/></Pressable>;
      })}</View>
    </View>}
  </View>;
}
