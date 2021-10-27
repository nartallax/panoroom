# Panoroom - программа для построения веб-панорам

## Установка

1. Установить [NodeJS](https://nodejs.org/en/)
Версии 14. Больше - лучше.  
Проверить, что установилось, можно написав в консоли команду `node --version`.  

2. [Скачать этот репозиторий](https://github.com/nartallax/panoroom/archive/refs/heads/master.zip) и распаковать куда угодно
Либо так, либо через `git clone`, не принципиально.  

3. Выполнить `npm install` в директории с этим всем (или запустить файл `install.bat`, который сделает то же самое)

## Использование

Файлы панорам и планов этажей можно пихать в директорию `content/img`. Если такой директории нет - её следует создать.  

Запустить `run.bat` или команду `node main.js` в директории с этим вот всем.  
После этого будет доступна [эта страничка](http://localhost:6301/content/). Там можно таскать этажи, панорамы, линковать туда-сюда, крутить настройки и так далее.  

После того, как все как следует отредактировано, можно взять содержимое директории `content` и запихнуть под какой-нибудь вебсервер, например, nginx. То, что лежит в content - статика, и не требует нашего специализированного приложения для работы. Т.е. хостить можно по сути дела где угодно. (я, например, заливал это все на github pages, и все оно замечательно работало).  