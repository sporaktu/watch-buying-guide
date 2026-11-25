from PIL import Image,ImageChops
M={'seagull-1963-42':'pk/seagull-1963-42__0','stowa-marine-original-41':'pk2/stowa__6','laco-bremerhaven-42-5':'pk/laco-bremerhaven-42-5__0','hanhart-417-es-heritage-flyback-42':'pk3/hanhart__0','christopher-ward-c12-loco':'pk2/cw1__0','oris-propilot-x-calibre-115':'pk/oris-propilot-x-calibre-115__0','tutima-patria-admiral-blue':'pk2/tutima2__0'}
sheet=Image.new('RGB',(400*4,300*2),(200,200,200));n=0
for k,f in M.items():
    im=Image.open('/tmp/mg/'+f+'.img')
    if im.mode in('RGBA','LA','P'):
        im=im.convert('RGBA');bg=Image.new('RGBA',im.size,(255,255,255,255));bg.alpha_composite(im);im=bg
    im=im.convert('RGB')
    bb=ImageChops.difference(im,Image.new('RGB',im.size,(255,255,255))).convert('L').point(lambda p:255 if p>14 else 0).getbbox()
    if bb: im=im.crop(bb)
    im.thumbnail((760,540),Image.LANCZOS)
    c=Image.new('RGB',(800,600),(255,255,255));c.paste(im,((800-im.width)//2,(600-im.height)//2))
    c.save('site/img/'+k+'.jpg','JPEG',quality=84,optimize=True,progressive=True)
    t=c.resize((396,297));sheet.paste(t,((n%4)*400+2,(n//4)*300+2));n+=1;print(k,im.size)
t=Image.open('site/img/trafford-crossroads-s-40-fern.jpg').resize((396,297));sheet.paste(t,((n%4)*400+2,(n//4)*300+2))
sheet.save('/tmp/mg/sheet_newpicks.jpg',quality=85)
